import type { SupabaseClient } from "@supabase/supabase-js";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type SessionActor = {
  kind: "student" | "staff" | "supervisor";
  userId: string;
  email: string;
  name: string;
  db: SupabaseClient;
};

export type WorkspaceActor = SessionActor & { workspaceId: string; role: "leader" | "member" | "staff" | "supervisor" };

/** The signed-in user on this host (student on share host, staff on inova), with a service-role client. */
export async function getSessionActor(): Promise<SessionActor | null> {
  const user = await getPortalUser();
  const db = getSupabaseAdminClient();
  if (!user || !db) return null;
  const meta = (user.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const metaName = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  if (isStaffUser(user)) {
    return { kind: "staff", userId: user.id, email: user.email ?? "", name: metaName ?? "Honic staff", db };
  }
  const email = (user.email ?? "").toLowerCase();
  const [{ data: p }, { data: sup }] = await Promise.all([
    db.from("student_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    db.from("portal_supervisor_profiles").select("full_name, email").eq("user_id", user.id).maybeSingle(),
  ]);
  // Prefer student membership when both profiles exist.
  const membership = await findMembership(db, user.id);
  if (membership || p?.full_name) {
    return {
      kind: "student",
      userId: user.id,
      email,
      name: (p?.full_name as string | undefined) ?? metaName ?? user.email ?? "Student",
      db,
    };
  }
  if (sup) {
    return {
      kind: "supervisor",
      userId: user.id,
      email: String(sup.email ?? email).toLowerCase(),
      name: String(sup.full_name || metaName || "Supervisor"),
      db,
    };
  }
  return {
    kind: "student",
    userId: user.id,
    email,
    name: metaName ?? user.email ?? "Student",
    db,
  };
}

/** Workspaces where this supervisor email is set on the team card. */
export async function workspacesForSupervisorEmail(db: SupabaseClient, email: string) {
  const e = email.trim().toLowerCase();
  if (!e) return [] as { id: string; name: string; supervisor_name: string | null }[];
  const { data } = await db
    .from("portal_workspaces")
    .select("id, name, supervisor_name, supervisor_email")
    .not("supervisor_email", "is", null);
  return (data ?? [])
    .filter((w) => String(w.supervisor_email ?? "").trim().toLowerCase() === e)
    .map((w) => ({ id: String(w.id), name: String(w.name), supervisor_name: (w.supervisor_name as string | null) ?? null }));
}

export async function supervisorCanAccessWorkspace(db: SupabaseClient, userId: string, email: string, workspaceId: string) {
  const list = await workspacesForSupervisorEmail(db, email);
  if (list.some((w) => w.id === workspaceId)) return true;
  const { data: sup } = await db.from("portal_supervisor_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(sup) && list.some((w) => w.id === workspaceId);
}

export async function findMembership(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("portal_workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { workspaceId: String(data.workspace_id), role: data.role as "leader" | "member" } : null;
}

/** Staff may open any workspace; students only their own; supervisors only when email matches. */
export async function requireWorkspaceActor(workspaceId: string): Promise<WorkspaceActor> {
  const actor = await getSessionActor();
  if (!actor) throw new Error("Please sign in again.");
  const id = String(workspaceId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Workspace not found.");
  if (actor.kind === "staff") {
    const { data } = await actor.db.from("portal_workspaces").select("id").eq("id", id).maybeSingle();
    if (!data) throw new Error("Workspace not found.");
    return { ...actor, workspaceId: id, role: "staff" };
  }
  if (actor.kind === "supervisor") {
    const ok = await supervisorCanAccessWorkspace(actor.db, actor.userId, actor.email, id);
    if (!ok) throw new Error("This project is not shared with your supervisor account.");
    return { ...actor, workspaceId: id, role: "supervisor" };
  }
  const m = await findMembership(actor.db, actor.userId);
  if (m && m.workspaceId === id) return { ...actor, workspaceId: id, role: m.role };
  const asSupervisor = await supervisorCanAccessWorkspace(actor.db, actor.userId, actor.email, id);
  if (asSupervisor) return { ...actor, kind: "supervisor", workspaceId: id, role: "supervisor" };
  throw new Error("You are not a member of this workspace.");
}

export async function logActivity(db: SupabaseClient, workspaceId: string, actorName: string, action: string) {
  const now = new Date().toISOString();
  await Promise.all([
    db.from("portal_activity").insert({ workspace_id: workspaceId, actor_name: actorName, action: action.slice(0, 300) }),
    db.from("portal_workspaces").update({ last_activity_at: now }).eq("id", workspaceId),
  ]);
}
