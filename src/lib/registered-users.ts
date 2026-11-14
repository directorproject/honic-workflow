import type { SupabaseClient } from "@supabase/supabase-js";

import type { User } from "@supabase/supabase-js";

import { isInAcademicYear, type AcademicYearSelection } from "@/lib/academic-year";
import { isStaffUser } from "@/lib/auth-staff";
import { ensurePortalAccount, ensurePortalAccounts, resolveStaffUserRef } from "@/lib/portal/accounts";
import { projectCategoryLabel, studyLevelLabel } from "@/lib/portal/config";
import { formatDate, formatDateTime } from "@/lib/workspace/dates";

export type RegisteredUserRow = {
  /** Opaque public id for URLs and forms (never put auth UUID in the browser). */
  id: string;
  /** Internal auth.users id — server-only; do not render in links. */
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
  institution: string | null;
  course: string | null;
  createdAt: string;
  registeredOn: string;
  emailConfirmed: boolean;
  /** True when staff has blocked this account from signing in. */
  blocked: boolean;
  staff: boolean;
  profileComplete: boolean;
  projectId: string | null;
  projectTitle: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
};

function isSignInBlocked(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  const until = new Date(bannedUntil).getTime();
  return Number.isFinite(until) && until > Date.now();
}

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  institution: string | null;
  course_code: string | null;
  course_other: string | null;
  tracked_project_id: string | null;
};

/** Every portal and staff account created in the selected working year. */
export async function fetchRegisteredUsers(
  db: SupabaseClient,
  year: AcademicYearSelection,
): Promise<RegisteredUserRow[]> {
  const users = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 200) break;
  }

  const inYear = users.filter((user) => isInAcademicYear(user.created_at, year));
  const [{ data: profiles, error: profileError }, { data: members, error: memberError }, { data: workspaces, error: workspaceError }] =
    await Promise.all([
      db
        .from("student_profiles")
        .select("user_id, full_name, phone, institution, course_code, course_other, tracked_project_id"),
      db.from("portal_workspace_members").select("user_id, workspace_id, role"),
      db.from("portal_workspaces").select("id, name"),
    ]);
  if (profileError) throw new Error(profileError.message);
  if (memberError) throw new Error(memberError.message);
  if (workspaceError) throw new Error(workspaceError.message);

  const profileByUser = new Map((profiles ?? []).map((row) => [String(row.user_id), row as ProfileRow]));
  const workspaceName = new Map((workspaces ?? []).map((row) => [String(row.id), String(row.name ?? "Workspace")]));
  const workspaceByUser = new Map<string, { id: string; name: string }>();
  for (const member of members ?? []) {
    const userId = String(member.user_id);
    if (workspaceByUser.has(userId)) continue;
    const id = String(member.workspace_id);
    workspaceByUser.set(userId, { id, name: workspaceName.get(id) ?? "Workspace" });
  }

  const projectIds = [
    ...new Set(
      inYear
        .map((user) => profileByUser.get(user.id)?.tracked_project_id)
        .filter((id): id is string => Boolean(id))
        .map(String),
    ),
  ];
  const projectTitle = new Map<string, string>();
  if (projectIds.length) {
    const { data: projects, error: projectError } = await db
      .from("tracked_projects")
      .select("id, title")
      .in("id", projectIds);
    if (projectError) throw new Error(projectError.message);
    for (const project of projects ?? []) {
      projectTitle.set(String(project.id), String(project.title ?? "Project"));
    }
  }

  const publicIds = await ensurePortalAccounts(
    db,
    inYear.map((user) => user.id),
  );

  return inYear
    .map((user) => {
      const profile = profileByUser.get(user.id);
      const courseOther = profile?.course_other?.trim();
      const course = courseOther || profile?.course_code?.trim() || null;
      const projectId = profile?.tracked_project_id ? String(profile.tracked_project_id) : null;
      const workspace = workspaceByUser.get(user.id) ?? null;
      const publicId = publicIds.get(user.id);
      if (!publicId) return null;
      return {
        id: publicId,
        userId: user.id,
        email: user.email ?? "",
        name: profile?.full_name?.trim() || null,
        phone: profile?.phone?.trim() || null,
        institution: profile?.institution?.trim() || null,
        course,
        createdAt: user.created_at,
        registeredOn: formatDate(user.created_at),
        emailConfirmed: Boolean(user.email_confirmed_at ?? user.confirmed_at),
        blocked: isSignInBlocked(user.banned_until),
        staff: isStaffUser(user),
        profileComplete: Boolean(profile),
        projectId,
        projectTitle: projectId ? (projectTitle.get(projectId) ?? "Linked project") : null,
        workspaceId: workspace?.id ?? null,
        workspaceName: workspace?.name ?? null,
      };
    })
    .filter((row): row is RegisteredUserRow => Boolean(row))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type RegisteredUserDetail = {
  /** Opaque public id for URLs and forms. */
  id: string;
  /** Internal auth.users id — server-only. */
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
  regNo: string | null;
  institution: string | null;
  course: string | null;
  studyLevel: string | null;
  yearOfStudy: string | null;
  academicYear: string | null;
  partner: string | null;
  projectCategory: string | null;
  changeCredits: number;
  registeredOn: string;
  lastSignIn: string;
  emailConfirmed: boolean;
  blocked: boolean;
  staff: boolean;
  profileComplete: boolean;
  projectId: string | null;
  projectTitle: string | null;
  title: { id: string; title: string; status: string } | null;
  titles: { id: string; title: string }[];
  workspaces: { id: string; name: string; role: string }[];
  activity: { who: string; action: string; when: string }[];
};

/** One account by opaque public id (or legacy auth UUID for redirects). */
export async function fetchRegisteredUser(db: SupabaseClient, ref: string): Promise<RegisteredUserDetail | null> {
  const resolved = await resolveStaffUserRef(db, ref);
  if (!resolved) return null;
  const { data, error } = await db.auth.admin.getUserById(resolved.userId);
  if (error) throw new Error(error.message);
  const user = data.user;
  if (!user) return null;
  const publicId = resolved.publicId || (await ensurePortalAccount(db, user.id));

  const [{ data: profile, error: profileError }, { data: title, error: titleError }, { data: picks, error: pickError }, { data: members, error: memberError }] =
    await Promise.all([
      db
        .from("student_profiles")
        .select(
          "full_name, phone, reg_no, institution, course_code, course_other, study_level, study_level_other, year_of_study, academic_year, partner, project_category, change_credits, tracked_project_id",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      db.from("title_proposals").select("id, title, status").eq("selected_by", user.id).maybeSingle(),
      db.from("title_selections").select("proposal_id, title").eq("user_id", user.id).is("released_at", null),
      db.from("portal_workspace_members").select("workspace_id, role").eq("user_id", user.id),
    ]);
  if (profileError) throw new Error(profileError.message);
  if (titleError) throw new Error(titleError.message);
  if (pickError) throw new Error(pickError.message);
  if (memberError) throw new Error(memberError.message);

  const chosen = new Map<string, string>();
  if (title) chosen.set(String(title.id), String(title.title));
  for (const pick of picks ?? []) {
    const id = pick.proposal_id ? String(pick.proposal_id) : String(pick.title);
    if (!chosen.has(id)) chosen.set(id, String(pick.title));
  }
  const titles = [...chosen.entries()].map(([id, name]) => ({ id, title: name }));

  const workspaceIds = [...new Set((members ?? []).map((row) => String(row.workspace_id)))];
  const projectId = profile?.tracked_project_id ? String(profile.tracked_project_id) : null;
  const [{ data: workspaces, error: workspaceError }, { data: project, error: projectError }, { data: activity, error: activityError }] =
    await Promise.all([
      workspaceIds.length
        ? db.from("portal_workspaces").select("id, name").in("id", workspaceIds)
        : Promise.resolve({ data: [], error: null }),
      projectId
        ? db.from("tracked_projects").select("id, title").eq("id", projectId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      workspaceIds.length
        ? db
            .from("portal_activity")
            .select("actor_name, action, created_at")
            .in("workspace_id", workspaceIds)
            .order("created_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (workspaceError) throw new Error(workspaceError.message);
  if (projectError) throw new Error(projectError.message);
  if (activityError) throw new Error(activityError.message);

  const workspaceName = new Map((workspaces ?? []).map((row) => [String(row.id), String(row.name ?? "Workspace")]));
  const courseOther = profile?.course_other?.trim();
  return toDetail(user, publicId, {
    name: profile?.full_name?.trim() || null,
    phone: profile?.phone?.trim() || null,
    regNo: profile?.reg_no?.trim() || null,
    institution: profile?.institution?.trim() || null,
    course: courseOther || profile?.course_code?.trim() || null,
    studyLevel: studyLevelLabel(profile?.study_level ? String(profile.study_level) : null, profile?.study_level_other),
    yearOfStudy: profile?.year_of_study?.trim() || null,
    academicYear: profile?.academic_year?.trim() || null,
    partner: profile?.partner?.trim() || null,
    projectCategory: projectCategoryLabel(profile?.project_category ? String(profile.project_category) : null),
    changeCredits: Number(profile?.change_credits ?? 0),
    profileComplete: Boolean(profile),
    projectId,
    projectTitle: project?.title ? String(project.title) : projectId ? "Linked project" : null,
    title: titles[0] ? { id: titles[0].id, title: titles[0].title, status: title ? String(title.status) : "available" } : null,
    titles,
    workspaces: (members ?? []).map((row) => ({
      id: String(row.workspace_id),
      name: workspaceName.get(String(row.workspace_id)) ?? "Workspace",
      role: String(row.role) === "leader" ? "Leader" : "Member",
    })),
    activity: (activity ?? []).map((row) => ({
      who: String(row.actor_name ?? "Someone"),
      action: String(row.action ?? ""),
      when: formatDateTime(row.created_at ? String(row.created_at) : null),
    })),
  });
}

function toDetail(
  user: User,
  publicId: string,
  extra: Omit<
    RegisteredUserDetail,
    "id" | "userId" | "email" | "registeredOn" | "lastSignIn" | "emailConfirmed" | "blocked" | "staff"
  >,
): RegisteredUserDetail {
  return {
    id: publicId,
    userId: user.id,
    email: user.email ?? "",
    registeredOn: formatDate(user.created_at),
    lastSignIn: user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "Not yet",
    emailConfirmed: Boolean(user.email_confirmed_at ?? user.confirmed_at),
    blocked: isSignInBlocked(user.banned_until),
    staff: isStaffUser(user),
    ...extra,
  };
}
