import type { SupabaseClient } from "@supabase/supabase-js";

import { academicYearLabel, academicYearOf } from "@/lib/academic-year";
import { OTHER_COURSE_CODE } from "@/lib/portal/config";
import { rankTitles, type PortalTitle, type StudentProfile } from "@/lib/portal/data";
import { polishBriefText, polishReferencesText } from "@/lib/portal/pdf-sections";
import { cachedConfirmedProposalIds, cachedLastYearProjects } from "@/lib/portal/portal-catalogue-cache";
import { MAX_TITLE_CHOICES, titleHideEntitlement } from "@/lib/portal/title-limits";
import { titleTermsStatus } from "@/lib/portal/title-terms";
import { academicYearFromText } from "@/lib/title-bank";

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
  /** Recommendations (preferred) or legacy limitations text from the source report. */
  limitations: string | null;
  /** Up to 5 bibliography entries taken from the source report REFERENCES chapter. */
  references: string | null;
  literatureNote: string | null;
  /** Earlier student work is read-only. A starting point may be taken, then changed. */
  kind: "earlier" | "study";
  canChoose: boolean;
  /** On the viewer's shortlist (selected, may not be peer-hidden yet). */
  isSelected?: boolean;
  /** Protected from classmates (same institution / course / level). */
  isHiddenFromPeers?: boolean;
};

/** Notes from import / PDF enrich use ## Problem / Main / Specific / Limitations / Literature. */
export function parseTitleBrief(notes: string | null | undefined): {
  problemStatement: string | null;
  objectives: string | null;
  specificObjectives: string | null;
  limitations: string | null;
  references: string | null;
  literatureNote: string | null;
} {
  const raw = typeof notes === "string" ? notes.trim() : "";
  if (!raw) {
    return {
      problemStatement: null,
      objectives: null,
      specificObjectives: null,
      limitations: null,
      references: null,
      literatureNote: null,
    };
  }
  const section = (heading: string) => {
    const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const match = raw.match(re);
    const body = match?.[1]?.trim() ?? "";
    return body || null;
  };
  return {
    problemStatement: polishBriefText(section("Problem statement"), "problem"),
    objectives: polishBriefText(section("Main objective"), "main"),
    specificObjectives: polishBriefText(section("Specific objectives"), "specific"),
    limitations: polishBriefText(
      section("Recommendations") ??
        section("Project limitations") ??
        section("Project weakness") ??
        section("Limitations"),
      "recommendations",
    ),
    references: polishReferencesText(section("References")),
    literatureNote: section("Literature and source"),
  };
}

function asHttpUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.includes("…")) return null;
  // Staff-imported catalogue PDFs use same-origin API paths.
  if (/^\/api\/portal\/catalogue-docs\//i.test(trimmed)) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return null;
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

export type LoadLiteratureOptions = {
  /** Parse enriched ## notes (heavy). Use on title detail only. */
  includeBriefs?: boolean;
};

/** Earlier projects plus titles a student may study. Pass a profile to hide titles already taken in that group. */
export async function loadLiterature(
  db: SupabaseClient,
  userId: string | null,
  profile: StudentProfile | null,
  options?: LoadLiteratureOptions,
): Promise<{ mine: ReviewItem[]; items: ReviewItem[] }> {
  const includeBriefs = options?.includeBriefs ?? false;
  const viewerKey = profile
    ? cohortKey({
        institution: profile.institution,
        courseCode: profile.courseCode,
        courseOther: profile.courseOther,
        studyLevel: profile.studyLevel,
        studyLevelOther: profile.studyLevelOther,
      })
    : "";

  const needsPeerVisibility = Boolean(profile && userId);
  const needsWorkspaceOverlay = includeBriefs;

  const proposalsQuery = includeBriefs
    ? db
        .from("title_proposals")
        .select(
          "id, title, summary, hardware, communication, course_code, institution, batch, notes, origin_ref, status, selected_by, created_at",
        )
        .neq("status", "dropped")
    : db
        .from("title_proposals")
        .select(
          "id, title, summary, hardware, communication, course_code, institution, batch, origin_ref, status, selected_by, created_at",
        )
        .neq("status", "dropped");

  const selectionsQuery = needsPeerVisibility
    ? db
        .from("title_selections")
        .select("user_id, proposal_id, title, selected_at, hidden_at")
        .is("released_at", null)
        .order("selected_at", { ascending: true })
    : Promise.resolve({
        data: [] as {
          user_id: string;
          proposal_id: string | null;
          title: string;
          selected_at: string;
          hidden_at: string | null;
        }[],
        error: null,
      });

  const workspacesQuery = needsWorkspaceOverlay
    ? db.from("portal_workspaces").select("title_proposal_id, problem_statement, objectives").not("title_proposal_id", "is", null)
    : Promise.resolve({
        data: [] as { title_proposal_id: string | null; problem_statement: string | null; objectives: string | null }[],
        error: null,
      });

  const [
    { data: proposals, error: titleError },
    { data: selections, error: selectionError },
    earlier,
    { data: workspaces, error: workspaceError },
    owned,
  ] = await Promise.all([
    proposalsQuery,
    selectionsQuery,
    cachedLastYearProjects(),
    workspacesQuery,
    cachedConfirmedProposalIds(),
  ]);
  if (titleError) throw new Error(titleError.message);
  if (selectionError) throw new Error(selectionError.message);
  if (workspaceError && !/does not exist|schema cache|portal_workspaces/i.test(workspaceError.message)) throw new Error(workspaceError.message);

  const workspaceByTitle = new Map<string, { problem: string | null; objectives: string | null }>();
  if (needsWorkspaceOverlay) {
    for (const row of workspaces ?? []) {
      const titleId = row.title_proposal_id ? String(row.title_proposal_id) : "";
      if (!titleId) continue;
      workspaceByTitle.set(titleId, {
        problem: typeof row.problem_statement === "string" && row.problem_statement.trim() ? row.problem_statement.trim() : null,
        objectives: typeof row.objectives === "string" && row.objectives.trim() ? row.objectives.trim() : null,
      });
    }
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
  const studies: ReviewItem[] = (proposals ?? []).map((row) => {
    const created = text(row.created_at);
    const createdDate = created ? new Date(created) : null;
    const year = createdDate && !Number.isNaN(createdDate.getTime()) ? academicYearOf(createdDate) : null;
    const id = String(row.id);
    const reserved = String(row.status) === "reserved";
    const workspace = workspaceByTitle.get(id);
    const summary = text(row.summary);
    const notes = includeBriefs && "notes" in row ? text(row.notes) : null;
    const brief = notes ? parseTitleBrief(notes) : null;
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
      problemStatement: workspace?.problem ?? brief?.problemStatement ?? summary,
      objectives: workspace?.objectives ?? brief?.objectives ?? null,
      specificObjectives: brief?.specificObjectives ?? null,
      limitations: brief?.limitations ?? null,
      references: brief?.references ?? null,
      literatureNote: brief?.literatureNote ?? null,
      kind: "study",
      canChoose: Boolean(profile) && !reserved && !owned.has(id) && !mineIds.has(id) && !hidden.has(id),
      isSelected: mineIds.has(id),
      isHiddenFromPeers: mineHiddenIds.has(id) || hidden.has(id),
    };
  });

  const past: ReviewItem[] = earlier.map((row) => {
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
      limitations: null,
      references: null,
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
  const { item } = await loadReviewItemWithCatalogue(db, userId, profile, id);
  return item;
}

/**
 * Light catalogue for the frame/sidebar plus one title with full brief (notes parsed once).
 */
export async function loadReviewItemWithCatalogue(
  db: SupabaseClient,
  userId: string | null,
  profile: StudentProfile | null,
  id: string,
  prefetchedReview?: { mine: ReviewItem[]; items: ReviewItem[] },
): Promise<{ item: ReviewItem | null; review: { mine: ReviewItem[]; items: ReviewItem[] } }> {
  const review = prefetchedReview ?? (await loadLiterature(db, userId, profile, { includeBriefs: false }));
  let item = [...review.mine, ...review.items].find((entry) => entry.id === id) ?? null;
  if (!item) return { item: null, review };

  if (item.kind === "earlier" || id.startsWith("earlier:")) {
    return { item, review };
  }

  const [proposalRes, workspaceRes] = await Promise.all([
    db
      .from("title_proposals")
      .select("id, title, summary, notes, origin_ref, status")
      .eq("id", id)
      .neq("status", "dropped")
      .maybeSingle(),
    db.from("portal_workspaces").select("problem_statement, objectives").eq("title_proposal_id", id).limit(1).maybeSingle(),
  ]);
  const { data: row, error } = proposalRes;
  if (error) throw new Error(error.message);
  if (!row) return { item: null, review };
  const workspace =
    workspaceRes.error && !/does not exist|schema cache|portal_workspaces/i.test(workspaceRes.error.message)
      ? null
      : workspaceRes.data;

  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const brief = parseTitleBrief(text(row.notes));
  const summary = text(row.summary);

  item = {
    ...item,
    summary: summary ?? item.summary,
    problemStatement: text(workspace?.problem_statement) ?? brief.problemStatement ?? summary ?? item.problemStatement,
    objectives: text(workspace?.objectives) ?? brief.objectives ?? item.objectives,
    specificObjectives: brief.specificObjectives,
    limitations: brief.limitations,
    references: brief.references,
    literatureNote: brief.literatureNote,
  };

  return { item, review };
}

/**
 * Shortlist for home / my projects. Intentionally light — does not load the
 * full literature catalogue (that belongs on /portal/titles only).
 */
export async function loadTitleChoices(db: SupabaseClient, userId: string, profile: StudentProfile): Promise<TitleChoiceState> {
  const [{ data: selections, error: selectionError }, { data: assigned, error: assignedError }] = await Promise.all([
    db
      .from("title_selections")
      .select("proposal_id, title, hidden_at")
      .eq("user_id", userId)
      .is("released_at", null),
    db
      .from("title_proposals")
      .select("id, title, summary, hardware, communication, course_code, institution")
      .eq("selected_by", userId),
  ]);
  if (selectionError) throw new Error(selectionError.message);
  if (assignedError) throw new Error(assignedError.message);

  const proposalIds = [...new Set((selections ?? []).map((row) => row.proposal_id).filter(Boolean).map(String))];
  const { data: proposalRows, error: proposalError } = proposalIds.length
    ? await db
        .from("title_proposals")
        .select("id, title, summary, hardware, communication, course_code, institution")
        .in("id", proposalIds)
    : { data: [] as Record<string, unknown>[], error: null };
  if (proposalError) throw new Error(proposalError.message);

  const byId = new Map<string, PortalTitle>();
  for (const row of [...(assigned ?? []), ...(proposalRows ?? [])]) {
    const title = choiceTitleFromRow(row as Record<string, unknown>);
    byId.set(title.id, title);
  }

  const hidden = new Set<string>();
  for (const row of selections ?? []) {
    const key = selectionKey(row.proposal_id, row.title);
    if (!key) continue;
    if (row.hidden_at) hidden.add(key);
    if (byId.has(key)) continue;
    // Earlier picks encode id in title (`earlier:<id>|<label>`).
    if (!key.startsWith("earlier:")) continue;
    const raw = typeof row.title === "string" ? row.title : key;
    const label = raw.includes("|") ? raw.slice(raw.indexOf("|") + 1).trim() : key;
    byId.set(key, {
      id: key,
      title: label || key,
      summary: null,
      hardware: null,
      communication: null,
      courseCode: null,
      institution: null,
      recommended: false,
    });
  }

  const mine = [...byId.values()].map((item) => ({
    ...item,
    hiddenFromPeers: hidden.has(item.id),
  }));

  return {
    profile,
    mine: rankTitles(mine, profile, userId),
    available: [],
  };
}

function choiceTitleFromRow(row: Record<string, unknown>): PortalTitle {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    summary: s(row.summary),
    hardware: s(row.hardware),
    communication: s(row.communication),
    courseCode: s(row.course_code),
    institution: s(row.institution),
    recommended: false,
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
  const review = await loadLiterature(db, userId, profile, { includeBriefs: false });
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

  const review = await loadLiterature(db, userId, profile, { includeBriefs: false });
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
