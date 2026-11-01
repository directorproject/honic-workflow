import type { SupabaseClient } from "@supabase/supabase-js";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type SessionActor = {
  kind: "student" | "staff";
  userId: string;
  email: string;
  name: string;
  db: SupabaseClient;
};

export type WorkspaceActor = SessionActor & { workspaceId: string; role: "leader" | "member" | "staff" };

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
  const { data: p } = await db.from("student_profiles").select("full_name").eq("user_id", user.id).maybeSingle();
  return {
    kind: "student",
    userId: user.id,
    email: user.email ?? "",
    name: (p?.full_name as string | undefined) ?? metaName ?? user.email ?? "Student",
    db,
  };
}

export async function findMembership(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("portal_workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { workspaceId: String(data.workspace_id), role: data.role as "leader" | "member" } : null;
}

/** Staff may open any workspace; students only their own. Throws a user-facing message otherwise. */
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
  const m = await findMembership(actor.db, actor.userId);
  if (!m || m.workspaceId !== id) throw new Error("You are not a member of this workspace.");
  return { ...actor, workspaceId: id, role: m.role };
}

export async function logActivity(db: SupabaseClient, workspaceId: string, actorName: string, action: string) {
  const now = new Date().toISOString();
  await Promise.all([
    db.from("portal_activity").insert({ workspace_id: workspaceId, actor_name: actorName, action: action.slice(0, 300) }),
    db.from("portal_workspaces").update({ last_activity_at: now }).eq("id", workspaceId),
  ]);
}
