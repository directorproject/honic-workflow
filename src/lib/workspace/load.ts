import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FREE_PLAN_FILE_STORAGE_BYTES,
  PAID_PLAN_FILE_STORAGE_BYTES,
} from "@/lib/portal/config";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";
import { scheduleHealth, type ScheduleHealth } from "@/lib/workspace/schedule";
import type {
  DocumentItem,
  Member,
  Message,
  ReviewMark,
  SharedDeadline,
  Task,
  Workspace,
  WorkspaceBundle,
} from "@/lib/workspace/types";

const FILE_COLS =
  "id, document_id, event_id, folder, name, size_bytes, mime_type, obtained_place, uploaded_by_name, created_at";
const FILE_COLS_LEGACY = "id, document_id, folder, name, size_bytes, mime_type, uploaded_by_name, created_at";

function rows<T>(res: { data: unknown }): T[] {
  return (Array.isArray(res.data) ? res.data : []) as T[];
}

type MemberWithLinks = Member & {
  course_code: string | null;
  tracked_project_id: string | null;
  desk_expires_at: string | null;
};

async function loadMembers(db: SupabaseClient, workspaceId: string): Promise<MemberWithLinks[]> {
  const { data: mem } = await db
    .from("portal_workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", workspaceId)
    .order("joined_at");
  const ids = (mem ?? []).map((m) => String(m.user_id));
  if (!ids.length) return [];
  const [{ data: profs }, users, { data: courses }] = await Promise.all([
    db
      .from("student_profiles")
      .select("user_id, full_name, institution, course_code, course_other, tracked_project_id, desk_expires_at")
      .in("user_id", ids),
    Promise.all(ids.map((id) => db.auth.admin.getUserById(id).then((r) => r.data.user))),
    db.from("courses").select("code, name"),
  ]);
  const courseName = new Map((courses ?? []).map((c) => [String(c.code), String(c.name)]));
  return (mem ?? []).map((m, i) => {
    const p = (profs ?? []).find((x) => String(x.user_id) === String(m.user_id));
    return {
      user_id: String(m.user_id),
      role: m.role as Member["role"],
      joined_at: String(m.joined_at),
      full_name: String(p?.full_name ?? users[i]?.email ?? "Student"),
      email: users[i]?.email ?? null,
      institution: p?.institution ? String(p.institution) : null,
      course: p ? String(p.course_other || courseName.get(String(p.course_code)) || p.course_code) : null,
      course_code: p?.course_code ? String(p.course_code) : null,
      tracked_project_id: p?.tracked_project_id ? String(p.tracked_project_id) : null,
      desk_expires_at: p?.desk_expires_at ? String(p.desk_expires_at) : null,
    };
  });
}

function storageLimitFromMembers(members: MemberWithLinks[]): number {
  if (members.some((m) => hasActiveDeskPlan(m.desk_expires_at))) return PAID_PLAN_FILE_STORAGE_BYTES;
  return FREE_PLAN_FILE_STORAGE_BYTES;
}

/** Shared deadlines that match a member's institution, course or the project type (null fields match all). */
function matchDeadlines(all: SharedDeadline[], institutions: string[], courses: string[], category: string | null) {
  const inst = institutions.map((s) => s.toLowerCase());
  return all.filter(
    (d) =>
      (!d.institution || inst.includes(d.institution.toLowerCase())) &&
      (!d.course_code || courses.includes(d.course_code)) &&
      (!d.project_category || d.project_category === category),
  );
}

function normalizeDocument(d: DocumentItem): DocumentItem {
  return {
    ...d,
    change_summary: d.change_summary ?? null,
    shared_with_supervisor: Boolean(d.shared_with_supervisor),
    parent_id: d.parent_id ?? null,
    page_from: d.page_from ?? null,
    page_to: d.page_to ?? null,
  };
}

function normalizeMark(m: ReviewMark): ReviewMark {
  return {
    ...m,
    body: m.body ?? null,
    page_number: m.page_number ?? null,
    pin_x: typeof m.pin_x === "number" ? m.pin_x : null,
    pin_y: typeof m.pin_y === "number" ? m.pin_y : null,
    strokes: Array.isArray(m.strokes) ? m.strokes : [],
  };
}

/** When supervisorView is true, only shared review items (and their marks/files) are included. */
export async function loadWorkspaceBundle(
  db: SupabaseClient,
  workspaceId: string,
  opts?: { supervisorView?: boolean },
): Promise<WorkspaceBundle | null> {
  const { data: ws } = await db.from("portal_workspaces").select("*").eq("id", workspaceId).maybeSingle();
  if (!ws) return null;
  const q = (table: string, cols = "*") => db.from(table).select(cols).eq("workspace_id", workspaceId);
  const supervisorView = Boolean(opts?.supervisorView);

  const [members, invites, phases, tasks, events, documents, files, logbook, datasets, parts, references, messages, bookings, comments, marks, invoices, defence, activity, deadlines] =
    await Promise.all([
      loadMembers(db, workspaceId),
      q("portal_workspace_invites", "id, email, token, created_at, accepted_at").is("accepted_at", null).order("created_at"),
      q("portal_phases", "id, name, color, sort_order").order("sort_order"),
      q("portal_tasks").order("sort_order").order("start_date", { nullsFirst: false }),
      q("portal_events").order("starts_on"),
      q("portal_documents").order("sort_order"),
      q("portal_files", FILE_COLS).order("created_at", { ascending: false }),
      q("portal_logbook").order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
      q("portal_datasets").order("created_at"),
      q("portal_parts").order("sort_order").order("created_at"),
      q("portal_references").order("created_at"),
      q("portal_messages").order("created_at", { ascending: false }).limit(300),
      q("portal_bookings").order("preferred_at", { ascending: false }),
      q("portal_comments").order("created_at"),
      q("portal_review_marks").order("created_at"),
      q("portal_invoices").order("created_at", { ascending: false }),
      q("portal_defence_items").order("kind").order("sort_order").order("created_at"),
      q("portal_activity").order("created_at", { ascending: false }).limit(150),
      db.from("portal_deadlines").select("*").order("due_date"),
    ]);

  const workspace = ws as Workspace;
  let docs = (rows(documents) as DocumentItem[]).map(normalizeDocument);
  // Fallback when newer file columns (event_id / obtained_place) are not migrated yet.
  let fileList = rows(files) as WorkspaceBundle["files"];
  if (!fileList.length && (files as { error?: { message?: string } }).error) {
    const msg = String((files as { error?: { message?: string } }).error?.message ?? "");
    if (/event_id|obtained_place|schema cache/i.test(msg)) {
      const retry = await q("portal_files", FILE_COLS_LEGACY).order("created_at", { ascending: false });
      fileList = rows(retry) as WorkspaceBundle["files"];
    }
  }
  let commentList = rows(comments) as WorkspaceBundle["comments"];
  let markList = (rows(marks) as ReviewMark[]).map(normalizeMark);

  if (supervisorView) {
    const sharedIds = new Set(docs.filter((d) => d.shared_with_supervisor).map((d) => d.id));
    docs = docs.filter((d) => sharedIds.has(d.id));
    fileList = fileList.filter((f) => !f.document_id || sharedIds.has(f.document_id));
    commentList = commentList.filter((c) => c.target_type !== "document" || sharedIds.has(c.target_id));
    markList = markList.filter((m) => sharedIds.has(m.document_id));
  }

  return {
    workspace,
    members: members.map((m) => ({
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      full_name: m.full_name,
      email: m.email,
      institution: m.institution,
      course: m.course,
    })),
    invites: rows(invites),
    phases: rows(phases),
    tasks: rows<Task>(tasks).map((t) => ({ ...t, depends_on: t.depends_on ?? [], checklist: Array.isArray(t.checklist) ? t.checklist : [] })),
    events: rows(events),
    deadlines: matchDeadlines(
      rows<SharedDeadline>(deadlines),
      members.map((m) => m.institution).filter((s): s is string => Boolean(s)),
      members.map((m) => m.course_code).filter((s): s is string => Boolean(s)),
      workspace.project_category,
    ),
    documents: docs,
    files: (fileList as WorkspaceBundle["files"]).map((f) => ({
      ...f,
      event_id: f.event_id ?? null,
      obtained_place: f.obtained_place ?? null,
    })),
    logbook: rows(logbook),
    datasets: rows(datasets),
    parts: rows(parts),
    references: rows(references),
    messages: rows(messages).reverse() as WorkspaceBundle["messages"],
    bookings: rows(bookings),
    comments: commentList,
    reviewMarks: markList,
    invoices: rows(invoices),
    defence: rows(defence),
    activity: rows(activity),
    trackedProjectId: members.find((m) => m.tracked_project_id)?.tracked_project_id ?? null,
    storageLimitBytes: storageLimitFromMembers(members),
  };
}

export type WorkspaceSummary = {
  id: string;
  name: string;
  category: string | null;
  members: { name: string; institution: string | null; courseCode: string | null }[];
  health: ScheduleHealth;
  lastActivityAt: string;
  defenceDate: string | null;
  /** Project start date, or the day the workspace was created. */
  startedAt: string;
  unreadMessages: number;
  pendingBookings: number;
  unpaidInvoices: number;
};

export type HelpDeskThread = {
  workspaceId: string;
  workspaceName: string;
  membersLabel: string;
  lastBody: string;
  lastAuthorName: string;
  lastAuthorKind: string;
  lastAt: string;
  unread: number;
};

/** Conversation list for the staff Help desk messaging app. */
export async function loadHelpDeskThreads(db: SupabaseClient): Promise<HelpDeskThread[]> {
  const [{ data: messages }, { data: workspaces }, { data: mem }, { data: profs }] = await Promise.all([
    db
      .from("portal_messages")
      .select("id, workspace_id, author_kind, author_name, body, created_at, staff_read_at")
      .order("created_at", { ascending: false })
      .limit(800),
    db.from("portal_workspaces").select("id, name"),
    db.from("portal_workspace_members").select("workspace_id, user_id, role"),
    db.from("student_profiles").select("user_id, full_name"),
  ]);

  const nameById = new Map((workspaces ?? []).map((w) => [String(w.id), String(w.name ?? "Workspace")]));
  const profileName = new Map((profs ?? []).map((p) => [String(p.user_id), String(p.full_name ?? "Student")]));
  const membersByWs = new Map<string, string[]>();
  for (const row of mem ?? []) {
    const wsId = String(row.workspace_id);
    const list = membersByWs.get(wsId) ?? [];
    list.push(profileName.get(String(row.user_id)) ?? "Student");
    membersByWs.set(wsId, list);
  }

  const threads = new Map<string, HelpDeskThread>();
  for (const m of messages ?? []) {
    const workspaceId = String(m.workspace_id);
    const unreadBump = m.author_kind === "student" && !m.staff_read_at ? 1 : 0;
    const existing = threads.get(workspaceId);
    if (existing) {
      existing.unread += unreadBump;
      continue;
    }
    threads.set(workspaceId, {
      workspaceId,
      workspaceName: nameById.get(workspaceId) ?? "Workspace",
      membersLabel: (membersByWs.get(workspaceId) ?? []).join(", ") || "Student team",
      lastBody: String(m.body ?? ""),
      lastAuthorName: String(m.author_name ?? "Student"),
      lastAuthorKind: String(m.author_kind ?? "student"),
      lastAt: String(m.created_at),
      unread: unreadBump,
    });
  }

  return [...threads.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function loadHelpDeskMessages(db: SupabaseClient, workspaceId: string): Promise<Message[]> {
  const { data, error } = await db
    .from("portal_messages")
    .select("id, author_kind, author_id, author_name, body, created_at, staff_read_at, student_read_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true })
    .limit(400);
  if (error) throw new Error(error.message);
  return (data ?? []) as Message[];
}

export async function countUnreadHelpDesk(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from("portal_messages")
    .select("id", { count: "exact", head: true })
    .eq("author_kind", "student")
    .is("staff_read_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Every workspace with schedule health, for the staff dashboard. */
export async function loadWorkspaceSummaries(db: SupabaseClient): Promise<WorkspaceSummary[]> {
  const [{ data: ws }, { data: mem }, { data: profs }, { data: tasks }, { data: unread }, { data: bookings }, { data: invoices }] = await Promise.all([
    db.from("portal_workspaces").select("id, name, project_category, last_activity_at, defence_date, start_date, created_at").order("last_activity_at", { ascending: false }),
    db.from("portal_workspace_members").select("workspace_id, user_id, role"),
    db.from("student_profiles").select("user_id, full_name, institution, course_code"),
    db.from("portal_tasks").select("id, workspace_id, title, status, progress, start_date, due_date, is_milestone, depends_on"),
    db.from("portal_messages").select("workspace_id").eq("author_kind", "student").is("staff_read_at", null),
    db.from("portal_bookings").select("workspace_id").eq("status", "requested"),
    db.from("portal_invoices").select("workspace_id").eq("status", "unpaid"),
  ]);
  const count = (list: { workspace_id: unknown }[] | null, id: string) => (list ?? []).filter((r) => String(r.workspace_id) === id).length;

  return (ws ?? []).map((w) => {
    const id = String(w.id);
    const members = (mem ?? [])
      .filter((m) => String(m.workspace_id) === id)
      .sort((a, b) => (a.role === "leader" ? -1 : b.role === "leader" ? 1 : 0))
      .map((m) => {
        const p = (profs ?? []).find((x) => String(x.user_id) === String(m.user_id));
        return {
          name: p?.full_name ? String(p.full_name) : "Student",
          institution: p?.institution ? String(p.institution) : null,
          courseCode: p?.course_code ? String(p.course_code) : null,
        };
      });
    const wsTasks = (tasks ?? []).filter((t) => String(t.workspace_id) === id) as unknown as Task[];
    return {
      id,
      name: String(w.name),
      category: w.project_category ? String(w.project_category) : null,
      members,
      health: scheduleHealth(wsTasks.map((t) => ({ ...t, depends_on: t.depends_on ?? [] }))),
      lastActivityAt: String(w.last_activity_at),
      defenceDate: w.defence_date ? String(w.defence_date) : null,
      startedAt: w.start_date ? String(w.start_date) : String(w.created_at),
      unreadMessages: count(unread, id),
      pendingBookings: count(bookings, id),
      unpaidInvoices: count(invoices, id),
    };
  });
}
