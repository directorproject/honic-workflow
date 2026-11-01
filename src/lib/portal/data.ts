import type { User } from "@supabase/supabase-js";

import { isStaffUser } from "@/lib/auth-staff";
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
  yearOfStudy: string;
  academicYear: string;
  partner: string | null;
  trackedProjectId: string | null;
  changeCredits: number;
};

export type PortalTitle = {
  id: string;
  title: string;
  summary: string | null;
  hardware: string | null;
  communication: string | null;
};

export type PortalState = {
  user: { id: string; email: string; suggestedName: string | null } | null;
  isStaff: boolean;
  profile: StudentProfile | null;
  courses: Course[];
  myTitle: PortalTitle | null;
  hasSelectedBefore: boolean;
  availableTitles: PortalTitle[];
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
  };
}

export async function loadCourses(): Promise<Course[]> {
  const db = getSupabaseAdminClient();
  if (!db) return [];
  const { data } = await db.from("courses").select("code, name").eq("is_active", true).order("sort_order").order("code");
  return (data ?? []).map((c) => ({ code: String(c.code), name: String(c.name) }));
}

export async function loadPortalState(): Promise<PortalState> {
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
  };
  if (!user) return empty;

  const meta = (user.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const suggestedName = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "") ?? null;
  const base = {
    ...empty,
    user: { id: user.id, email: user.email ?? "", suggestedName },
    isStaff: isStaffUser(user),
  };
  const db = getSupabaseAdminClient();
  if (!db || base.isStaff) return base;

  const { data: p } = await db.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!p) return base;

  const profile: StudentProfile = {
    fullName: String(p.full_name),
    regNo: p.reg_no ? String(p.reg_no) : null,
    phone: String(p.phone),
    institution: String(p.institution),
    courseCode: String(p.course_code),
    courseOther: p.course_other ? String(p.course_other) : null,
    yearOfStudy: String(p.year_of_study),
    academicYear: String(p.academic_year),
    partner: p.partner ? String(p.partner) : null,
    trackedProjectId: p.tracked_project_id ? String(p.tracked_project_id) : null,
    changeCredits: Number(p.change_credits ?? 0),
  };

  const cols = "id, title, summary, hardware, communication";
  const [mine, prior, available] = await Promise.all([
    db.from("title_proposals").select(cols).eq("selected_by", user.id).maybeSingle(),
    db.from("title_selections").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    db
      .from("title_proposals")
      .select(cols)
      .eq("status", "available")
      .is("selected_by", null)
      .eq("course_code", profile.courseCode)
      .order("title", { ascending: true }),
  ]);

  return {
    ...base,
    profile,
    myTitle: mine.data ? toTitle(mine.data) : null,
    hasSelectedBefore: (prior.count ?? 0) > 0,
    availableTitles: (available.data ?? []).map(toTitle),
  };
}
