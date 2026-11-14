import type { SupabaseClient } from "@supabase/supabase-js";

import { academicYearLabel, academicYearOf } from "@/lib/academic-year";
import { OTHER_COURSE_CODE } from "@/lib/portal/config";
import { confirmedProposalIds } from "@/lib/portal/title-claims";
import { titleTermsStatus } from "@/lib/portal/title-terms";
import { academicYearFromText } from "@/lib/title-bank";
import { rankTitles, type PortalTitle, type StudentProfile } from "@/lib/portal/data";
import { MAX_TITLE_CHOICES, titleHideEntitlement } from "@/lib/portal/title-limits";

export { MAX_TITLE_CHOICES };

type GroupProfile = {
  userId: string;
  institution: string;
  courseCode: string;
  courseOther: string | null;
  studyLevel: string | null;
  studyLevelOther: string | null;
};

/** Same institution, department, and level. A chosen title is hidden only inside this group. */
export function cohortKey(profile: Omit<GroupProfile, "userId">): string {
  const institution = profile.institution.trim().toLowerCase();
  const department =
    profile.courseCode === OTHER_COURSE_CODE
      ? `other:${(profile.courseOther ?? "").trim().toLowerCase()}`
      : profile.courseCode.trim().toUpperCase();
  const level =
    profile.studyLevel === "other"
      ? `other:${(profile.studyLevelOther ?? "").trim().toLowerCase()}`
      : (profile.studyLevel ?? "").trim().toLowerCase();
  return `${institution}|${department}|${level}`;
}

export type TitleChoiceState = {
  profile: StudentProfile;
  mine: PortalTitle[];
  available: PortalTitle[];
};

export type ReviewItem = {
  id: string;
  title: string;
  summary: string | null;
  hardware: string | null;
  communication: string | null;
  courseCode: string | null;
  institution: string | null;
  batch: string | null;
  source: string | null;
  /** Public list, PDF, or project page students can open for literature. */
  sourceUrl: string | null;
  year: number | null;
  yearLabel: string;
  problemStatement: string | null;
  objectives: string | null;
  specificObjectives: string | null;
  literatureNote: string | null;
  /** Earlier student work is read-only. A starting point may be taken, then changed. */
  kind: "earlier" | "study";
  canChoose: boolean;
  /** On the viewer's shortlist (selected, may not be peer-hidden yet). */
  isSelected?: boolean;
  /** Protected from classmates (same institution / course / level). */
  isHiddenFromPeers?: boolean;
};

/** Notes from import use ## Main objective / Specific objectives / Literature and source. */
export function parseTitleBrief(notes: string | null | undefined): {
  objectives: string | null;
  specificObjectives: string | null;
  literatureNote: string | null;
} {
  const raw = typeof notes === "string" ? notes.trim() : "";
  if (!raw) return { objectives: null, specificObjectives: null, literatureNote: null };
  const section = (heading: string) => {
    const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const match = raw.match(re);
    const body = match?.[1]?.trim() ?? "";
    return body || null;
  };
  return {
    objectives: section("Main objective"),
    specificObjectives: section("Specific objectives"),
    literatureNote: section("Literature and source"),
  };
}

function asHttpUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (trimmed.includes("…")) return null;
  return trimmed;
}

const UNRECORDED_YEAR = "Year not recorded";

function asGroup(row: Record<string, unknown>): GroupProfile {
  return {
    userId: String(row.user_id),
    institution: String(row.institution ?? ""),
    courseCode: String(row.course_code ?? ""),
    courseOther: row.course_other ? String(row.course_other) : null,
    studyLevel: row.study_level ? String(row.study_level) : null,
    studyLevelOther: row.study_level_other ? String(row.study_level_other) : null,
  };
}

function yearFromSource(source: string): number | null {
  const labeled = source.match(/(20\d{2})\s*\/\s*(20\d{2})/);
  if (labeled) return Number(labeled[1]);
  return academicYearFromText(source);
}

function yearLabel(year: number | null): string {
  return year == null ? UNRECORDED_YEAR : academicYearLabel(year);
}

function asPortalTitle(item: ReviewItem): PortalTitle {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    hardware: item.hardware,
    communication: item.communication,
    courseCode: item.courseCode,
    institution: item.institution,
    recommended: false,
    hiddenFromPeers: Boolean(item.isHiddenFromPeers),
  };
}

/** Earlier projects plus titles a student may study. Pass a profile to hide titles already taken in that group. */
export async function loadLiterature(
  db: SupabaseClient,
  userId: string | null,
  profile: StudentProfile | null,
): Promise<{ mine: ReviewItem[]; items: ReviewItem[] }> {
  const viewerKey = profile
    ? cohortKey({
        institution: profile.institution,
        courseCode: profile.courseCode,
        courseOther: profile.courseOther,
        studyLevel: profile.studyLevel,
        studyLevelOther: profile.studyLevelOther,
      })
    : "";

  const [{ data: proposals, error: titleError }, { data: selections, error: selectionError }, { data: earlier, error: earlierError }, { data: workspaces, error: workspaceError }] =
    await Promise.all([
      db
        .from("title_proposals")
        .select("id, title, summary, hardware, communication, course_code, institution, batch, notes, origin_ref, status, selected_by, created_at")
        .neq("status", "dropped"),
      // `title` is required for earlier:* picks (proposal_id is null; id is encoded in title).
      db
        .from("title_selections")
        .select("user_id, proposal_id, title, selected_at, hidden_at")
        .is("released_at", null)
        .order("selected_at", { ascending: true }),
      db.from("last_year_projects").select("id, programme, source, title"),
      db.from("portal_workspaces").select("title_proposal_id, problem_statement, objectives").not("title_proposal_id", "is", null),
    ]);
  if (titleError) throw new Error(titleError.message);
  if (selectionError) throw new Error(selectionError.message);
  if (earlierError) throw new Error(earlierError.message);
  if (workspaceError && !/does not exist|schema cache|portal_workspaces/i.test(workspaceError.message)) throw new Error(workspaceError.message);

  const workspaceByTitle = new Map<string, { problem: string | null; objectives: string | null }>();
  for (const row of workspaces ?? []) {
    const titleId = row.title_proposal_id ? String(row.title_proposal_id) : "";
    if (!titleId) continue;
    workspaceByTitle.set(titleId, {
      problem: typeof row.problem_statement === "string" && row.problem_statement.trim() ? row.problem_statement.trim() : null,
      objectives: typeof row.objectives === "string" && row.objectives.trim() ? row.objectives.trim() : null,
    });
  }

  const holderIds = new Set<string>();
  if (profile && userId) {
    for (const row of selections ?? []) holderIds.add(String(row.user_id));
    for (const row of proposals ?? []) {
      if (row.selected_by) holderIds.add(String(row.selected_by));
    }
    holderIds.delete(userId);
  }

  const groups = new Map<string, string>();
  if (holderIds.size) {
    const { data: profiles, error } = await db
      .from("student_profiles")
      .select("user_id, institution, course_code, course_other, study_level, study_level_other")
      .in("user_id", [...holderIds]);
    if (error) throw new Error(error.message);
    for (const row of profiles ?? []) {
      const group = asGroup(row);
      groups.set(group.userId, cohortKey(group));
    }
  }

  const hidden = new Set<string>();
  const mineIds = new Set<string>();
  const mineHiddenIds = new Set<string>();
  if (userId) {
    for (const row of selections ?? []) {
      const holder = String(row.user_id);
      const key = selectionKey(row.proposal_id, row.title);
      if (!key) continue;
      const peerHidden = Boolean(row.hidden_at);
      if (holder === userId) {
        mineIds.add(key);
        if (peerHidden) mineHiddenIds.add(key);
      } else if (peerHidden && profile && groups.get(holder) === viewerKey) {
        // Only peer-hidden titles leave the open pool for classmates.
        hidden.add(key);
      }
    }
    for (const row of proposals ?? []) {
      const holder = row.selected_by ? String(row.selected_by) : "";
      if (!holder) continue;
      // Legacy assigned proposals count as peer-hidden.
      if (holder === userId) {
        mineIds.add(String(row.id));
        mineHiddenIds.add(String(row.id));
      } else if (profile && groups.get(holder) === viewerKey) {
        hidden.add(String(row.id));
      }
    }
  }

  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const owned = await confirmedProposalIds(db);
  const studies: ReviewItem[] = (proposals ?? []).map((row) => {
    const created = text(row.created_at);
    const createdDate = created ? new Date(created) : null;
    const year = createdDate && !Number.isNaN(createdDate.getTime()) ? academicYearOf(createdDate) : null;
    const id = String(row.id);
    const reserved = String(row.status) === "reserved";
    const workspace = workspaceByTitle.get(id);
    const brief = parseTitleBrief(text(row.notes));
    const summary = text(row.summary);
    const sourceUrl = asHttpUrl(text(row.origin_ref));
    return {
      id,
      title: String(row.title ?? ""),
      summary,
      hardware: text(row.hardware),
      communication: text(row.communication),
      courseCode: text(row.course_code),
      institution: text(row.institution) ?? "Dar es Salaam Institute of Technology (DIT)",
      batch: text(row.batch),
      source: null,
      sourceUrl,
      year,
      yearLabel: yearLabel(year),
      problemStatement: workspace?.problem ?? summary,
      objectives: workspace?.objectives ?? brief.objectives,
      specificObjectives: brief.specificObjectives,
      literatureNote: brief.literatureNote,
      kind: "study",
      canChoose: Boolean(profile) && !reserved && !owned.has(id) && !mineIds.has(id) && !hidden.has(id),
      isSelected: mineIds.has(id),
      isHiddenFromPeers: mineHiddenIds.has(id) || hidden.has(id),
    };
  });

  const past: ReviewItem[] = (earlier ?? []).map((row) => {
    const source = text(row.source);
    const year = source ? yearFromSource(source) : null;
    const id = `earlier:${String(row.id)}`;
    return {
      id,
      title: String(row.title ?? ""),
      summary: null,
      hardware: null,
      communication: null,
      courseCode: text(row.programme),
      institution: "Dar es Salaam Institute of Technology (DIT)",
      batch: null,
      source,
      sourceUrl: null,
      year,
      yearLabel: yearLabel(year),
      problemStatement: null,
      objectives: null,
      specificObjectives: null,
      literatureNote: null,
      kind: "earlier",
      canChoose: Boolean(profile) && !mineIds.has(id) && !hidden.has(id),
      isSelected: mineIds.has(id),
      isHiddenFromPeers: mineHiddenIds.has(id) || hidden.has(id),
    };
  });

  return {
    mine: [...studies, ...past]
      .filter((item) => mineIds.has(item.id))
      .map((item) => ({
        ...item,
        isSelected: true,
        isHiddenFromPeers: mineHiddenIds.has(item.id),
      })),
    items: [
      ...studies.filter((item) => !mineIds.has(item.id) && !hidden.has(item.id)),
      ...past.filter((item) => !mineIds.has(item.id) && !hidden.has(item.id)),
    ],
  };
}

/** One title this viewer is allowed to read, including a title they already hold. */
export async function findReviewItem(
  db: SupabaseClient,
  userId: string | null,
  profile: StudentProfile | null,
  id: string,
): Promise<ReviewItem | null> {
  const review = await loadLiterature(db, userId, profile);
  return [...review.mine, ...review.items].find((item) => item.id === id) ?? null;
}

/** Titles this student can still choose, plus the ones they already hold. */
export async function loadTitleChoices(db: SupabaseClient, userId: string, profile: StudentProfile): Promise<TitleChoiceState> {
  const review = await loadLiterature(db, userId, profile);
  return {
    profile,
    mine: rankTitles(review.mine.map(asPortalTitle), profile, userId),
    available: rankTitles(
      review.items.filter((item) => item.canChoose).map(asPortalTitle),
      profile,
      userId,
    ),
  };
}

/**
 * Free shortlist: keeps the title in front for this student.
 * Does NOT hide it from classmates until hideTitleFromPeers (plan free hide or paid).
 * This is not a title shop — it helps you work confidently and avoid defence conflicts.
 */
export async function chooseTitle(db: SupabaseClient, userId: string, profile: StudentProfile, proposalId: string): Promise<void> {
  const account = await db.auth.admin.getUserById(userId);
  if (account.error) throw new Error(account.error.message);
  if (!titleTermsStatus(account.data.user?.user_metadata).accepted) {
    throw new Error("Accept the title rules before you take a title.");
  }
  const id = String(proposalId ?? "").trim();
  if (!id) throw new Error("Choose a title.");
  const review = await loadLiterature(db, userId, profile);
  const held = review.mine;
  if (held.length >= MAX_TITLE_CHOICES) throw new Error(`You can shortlist up to ${MAX_TITLE_CHOICES} titles.`);
  if (held.some((title) => title.id === id)) throw new Error("You already chose this title.");
  const title = [...held, ...review.items].find((item) => item.id === id && item.canChoose);
  if (!title) {
    throw new Error("A student at your institution, in your department and at your level, already hid this title.");
  }

  const earlierId = id.startsWith("earlier:") ? id.slice("earlier:".length) : null;
  const { error } = await db.from("title_selections").insert({
    user_id: userId,
    proposal_id: earlierId ? null : id,
    title: earlierId ? `earlier:${earlierId}|${title.title}` : title.title,
    hidden_at: null,
  });
  if (error) throw new Error(error.message);
}

/** Protect a shortlisted title from classmates (same institution / course / level). */
export async function hideTitleFromPeers(
  db: SupabaseClient,
  userId: string,
  profile: StudentProfile,
  proposalId: string,
): Promise<void> {
  const id = String(proposalId ?? "").trim();
  if (!id) throw new Error("Choose a title to hide.");

  const review = await loadLiterature(db, userId, profile);
  const held = review.mine.find((item) => item.id === id);
  if (!held) throw new Error("Select this title first, then hide it from classmates.");
  if (held.isHiddenFromPeers) throw new Error("This title is already hidden from classmates.");

  const hiddenCount = review.mine.filter((item) => item.isHiddenFromPeers).length;
  const entitlement = titleHideEntitlement({
    deskExpiresAt: profile.deskExpiresAt,
    changeCredits: profile.changeCredits,
    selectedCount: review.mine.length,
    hiddenCount,
  });

  let usedPaidCredit = false;
  if (entitlement.freeRemaining <= 0) {
    if (entitlement.hideCredits < 1) throw new Error("payment_required_hide");
    const { data: claimed, error: creditError } = await db
      .from("student_profiles")
      .update({
        change_credits: entitlement.hideCredits - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .gte("change_credits", 1)
      .select("change_credits")
      .maybeSingle();
    if (creditError) throw new Error(creditError.message);
    if (!claimed) throw new Error("payment_required_hide");
    usedPaidCredit = true;
  }

  let q = db
    .from("title_selections")
    .update({ hidden_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("released_at", null)
    .is("hidden_at", null);
  if (id.startsWith("earlier:")) {
    const idPart = id.slice("earlier:".length).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    q = q.ilike("title", `earlier:${idPart}|%`);
  } else {
    q = q.eq("proposal_id", id);
  }
  const { data: updated, error } = await q.select("id").maybeSingle();
  if (error || !updated) {
    if (usedPaidCredit) {
      await db
        .from("student_profiles")
        .update({
          change_credits: entitlement.hideCredits,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
    throw new Error(error?.message ?? "Could not hide this title.");
  }
}

function selectionKey(proposalId: unknown, title: unknown): string | null {
  if (proposalId) return String(proposalId);
  const raw = typeof title === "string" ? title : "";
  const earlier = /^earlier:([^|\s]+)/.exec(raw);
  return earlier ? `earlier:${earlier[1]}` : null;
}
