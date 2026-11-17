import type { User } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { isStaffUser } from "@/lib/auth-staff";
import { PORTAL_COURSES_TAG } from "@/lib/portal/portal-catalogue-cache";
import { titleTermsStatus, type TermsProgress } from "@/lib/portal/title-terms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type Course = { code: string; name: string };

export type StudentProfile = {
  fullName: string;
  regNo: string | null;
  phone: string;
  institution: string;
  courseCode: string;
  courseOther: string | null;
  studyLevel: string | null;
  studyLevelOther: string | null;
  projectCategory: string | null;
  yearOfStudy: string | null;
  academicYear: string;
  partner: string | null;
  trackedProjectId: string | null;
  changeCredits: number;
  /** Active desk membership end (ISO). Null / past = free mode. */
  deskExpiresAt: string | null;
  deskPlan: string | null;
};

export type PortalTitle = {
  id: string;
  title: string;
  summary: string | null;
  hardware: string | null;
  communication: string | null;
  courseCode: string | null;
  institution: string | null;
  /** True for the top matches on the student's course and institution. */
  recommended: boolean;
  /** Hidden from same institution/course/level peers (paid or plan free hide). */
  hiddenFromPeers?: boolean;
};

/** How many best-matching titles are pinned to the top before the rest are mixed. */
const RECOMMENDED_LIMIT = 20;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Top: titles matching the student's course and institution (both first, then course, then institution),
 * capped at RECOMMENDED_LIMIT. Below: everything else in a mixed order that stays stable for the student.
 */
export function rankTitles(titles: PortalTitle[], profile: StudentProfile, seed: string): PortalTitle[] {
  const course = profile.courseCode;
  const inst = profile.institution.toLowerCase();
  const score = (t: PortalTitle) =>
    (t.courseCode && t.courseCode === course ? 2 : 0) + (t.institution && t.institution.toLowerCase() === inst ? 1 : 0);

  const matched = titles
    .filter((t) => score(t) > 0)
    .sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title));
  const top = matched.slice(0, RECOMMENDED_LIMIT).map((t) => ({ ...t, recommended: true }));
  const topIds = new Set(top.map((t) => t.id));
  const rest = titles
    .filter((t) => !topIds.has(t.id))
    .map((t) => ({ t, k: hashString(`${seed}:${t.id}`) }))
    .sort((a, b) => a.k - b.k)
    .map(({ t }) => ({ ...t, recommended: false }));
  return [...top, ...rest];
}

export function studentNeedsPasswordSetup(user: User): boolean {
  return !(user.identities ?? []).some((identity) => identity.provider === "email");
}

export type PortalState = {
  user: { id: string; email: string; suggestedName: string | null; needsPasswordSetup: boolean } | null;
  isStaff: boolean;
  profile: StudentProfile | null;
  courses: Course[];
  myTitle: PortalTitle | null;
  hasSelectedBefore: boolean;
  availableTitles: PortalTitle[];
  /** From the session user — avoids a slow auth admin lookup on every page. */
  titleTerms: TermsProgress | null;
};

export async function getPortalUser(): Promise<User | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

function toTitle(r: Record<string, unknown>): PortalTitle {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    summary: s(r.summary),
    hardware: s(r.hardware),
    communication: s(r.communication),
    courseCode: s(r.course_code),
    institution: s(r.institution),
    recommended: false,
  };
}

const fetchActiveCourses = async (): Promise<Course[]> => {
  const db = getSupabaseAdminClient();
  if (!db) return [];
  const { data } = await db.from("courses").select("code, name").eq("is_active", true).order("sort_order").order("code");
  return (data ?? []).map((c) => ({ code: String(c.code), name: String(c.name) }));
};

export const loadCourses = cache(async (): Promise<Course[]> =>
  unstable_cache(fetchActiveCourses, ["portal-courses-v1"], { revalidate: 600, tags: [PORTAL_COURSES_TAG] })(),
);

/**
 * Shared portal session + profile. Kept light on purpose: every portal page
 * calls this, so it must not pull the full literature catalogue.
 */
export const loadPortalState = cache(async (): Promise<PortalState> => {
  const user = await getPortalUser();
  const courses = await loadCourses();
  const empty: PortalState = {
    user: null,
    isStaff: false,
    profile: null,
    courses,
    myTitle: null,
    hasSelectedBefore: false,
    availableTitles: [],
    titleTerms: null,
  };
  if (!user) return empty;

  const meta = (user.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const suggestedName = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "") ?? null;
  const titleTerms = titleTermsStatus(user.user_metadata);
  const base = {
    ...empty,
    user: {
      id: user.id,
      email: user.email ?? "",
      suggestedName,
      needsPasswordSetup: studentNeedsPasswordSetup(user),
    },
    isStaff: isStaffUser(user),
    titleTerms,
  };
  const db = getSupabaseAdminClient();
  if (!db || base.isStaff) return base;

  const [{ data: p }, mine] = await Promise.all([
    db.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    db
      .from("title_proposals")
      .select("id, title, summary, hardware, communication, course_code, institution")
      .eq("selected_by", user.id)
      .maybeSingle(),
  ]);
  if (!p) return base;

  const profile: StudentProfile = {
    fullName: String(p.full_name),
    regNo: p.reg_no ? String(p.reg_no) : null,
    phone: p.phone ? String(p.phone) : "",
    institution: String(p.institution),
    courseCode: String(p.course_code),
    courseOther: p.course_other ? String(p.course_other) : null,
    studyLevel: p.study_level ? String(p.study_level) : null,
    studyLevelOther: p.study_level_other ? String(p.study_level_other) : null,
    projectCategory: p.project_category ? String(p.project_category) : null,
    yearOfStudy: p.year_of_study ? String(p.year_of_study) : null,
    academicYear: String(p.academic_year),
    partner: p.partner ? String(p.partner) : null,
    trackedProjectId: p.tracked_project_id ? String(p.tracked_project_id) : null,
    changeCredits: Number(p.change_credits ?? 0),
    deskExpiresAt: p.desk_expires_at ? String(p.desk_expires_at) : null,
    deskPlan: p.desk_plan ? String(p.desk_plan) : null,
  };

  return {
    ...base,
    profile,
    myTitle: mine.data ? toTitle(mine.data) : null,
  };
});
