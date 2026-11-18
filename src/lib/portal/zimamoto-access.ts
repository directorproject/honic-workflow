import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

// Access rules (migration 031_zimamoto_invites.sql):
// - Public group: anyone signed in can join by its ID (from discovery or a shared link).
// - Private group: only an invitation created by the owner (admin) lets someone in.
// Members never invite others, so the owner controls who gets in.

export type ZimamotoInvite = {
  id: string;
  code: string;
  uses: number;
  maxUses: number;
  expiresAt: string;
  revoked: boolean;
  expired: boolean;
  createdAt: string;
};

type GroupRow = { id: string; public_id: string; is_private: boolean; owner_user_id: string; name: string };

async function groupById(db: SupabaseClient, groupId: string): Promise<GroupRow | null> {
  const { data } = await db
    .from("zimamoto_groups")
    .select("id, public_id, is_private, owner_user_id, name")
    .eq("id", groupId)
    .maybeSingle();
  return (data as GroupRow | null) ?? null;
}

async function requireOwner(db: SupabaseClient, groupId: string, userId: string): Promise<{ ok: true; group: GroupRow } | { ok: false; message: string }> {
  const group = await groupById(db, groupId);
  if (!group) return { ok: false, message: "Group not found." };
  if (group.owner_user_id !== userId) return { ok: false, message: "Only the group admin can do this." };
  return { ok: true, group };
}

function toInvite(row: Record<string, unknown>): ZimamotoInvite {
  const expiresAt = String(row.expires_at);
  return {
    id: String(row.id),
    code: String(row.code),
    uses: Number(row.uses ?? 0),
    maxUses: Number(row.max_uses ?? 0),
    expiresAt,
    revoked: Boolean(row.revoked_at),
    expired: new Date(expiresAt).getTime() <= Date.now(),
    createdAt: String(row.created_at),
  };
}

export async function listInvites(db: SupabaseClient, groupId: string, userId: string): Promise<ZimamotoInvite[]> {
  const owner = await requireOwner(db, groupId, userId);
  if (!owner.ok) return [];
  const { data } = await db
    .from("zimamoto_invites")
    .select("id, code, uses, max_uses, expires_at, revoked_at, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as Record<string, unknown>[]).map(toInvite);
}

export async function createInvite(
  db: SupabaseClient,
  input: { groupId: string; userId: string; maxUses?: number; days?: number },
): Promise<{ ok: true; invite: ZimamotoInvite } | { ok: false; message: string }> {
  const owner = await requireOwner(db, input.groupId, input.userId);
  if (!owner.ok) return owner;
  if (!owner.group.is_private) return { ok: false, message: "Public groups are open to everyone. No invitation needed." };

  const maxUses = Math.min(500, Math.max(1, Math.round(input.maxUses ?? 25)));
  const days = Math.min(90, Math.max(1, Math.round(input.days ?? 14)));
  const code = randomBytes(18).toString("base64url");
  const { data, error } = await db
    .from("zimamoto_invites")
    .insert({
      group_id: input.groupId,
      code,
      created_by: input.userId,
      max_uses: maxUses,
      expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    })
    .select("id, code, uses, max_uses, expires_at, revoked_at, created_at")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not create the invitation." };
  return { ok: true, invite: toInvite(data as Record<string, unknown>) };
}

export async function revokeInvite(
  db: SupabaseClient,
  input: { inviteId: string; userId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: inv } = await db.from("zimamoto_invites").select("group_id").eq("id", input.inviteId).maybeSingle();
  if (!inv) return { ok: false, message: "Invitation not found." };
  const owner = await requireOwner(db, String(inv.group_id), input.userId);
  if (!owner.ok) return owner;
  const { error } = await db.from("zimamoto_invites").update({ revoked_at: new Date().toISOString() }).eq("id", input.inviteId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Join a group. `code` is either a public group's ID (public groups only) or a private
 * group's invitation code. Anything else is refused.
 */
export async function joinGroup(
  db: SupabaseClient,
  input: { userId: string; code: string },
): Promise<{ ok: true; publicId: string } | { ok: false; message: string }> {
  const code = input.code.trim();
  if (code.length < 16) return { ok: false, message: "Paste the full invitation code or group link." };

  // 1. Public group, by its ID.
  const { data: publicGroup } = await db
    .from("zimamoto_groups")
    .select("id, public_id, is_private")
    .eq("public_id", code)
    .maybeSingle();
  if (publicGroup) {
    if (publicGroup.is_private) {
      return { ok: false, message: "This group is private. Ask the admin for an invitation." };
    }
    const { error } = await db
      .from("zimamoto_group_members")
      .upsert({ group_id: publicGroup.id, user_id: input.userId, role: "member" }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
    if (error) return { ok: false, message: error.message };
    return { ok: true, publicId: String(publicGroup.public_id) };
  }

  // 2. Private group, by invitation.
  const { data: inv } = await db
    .from("zimamoto_invites")
    .select("id, group_id, uses, max_uses, expires_at, revoked_at")
    .eq("code", code)
    .maybeSingle();
  if (!inv) return { ok: false, message: "That invitation is not valid. Ask the admin for a new one." };
  if (inv.revoked_at) return { ok: false, message: "This invitation was cancelled by the admin." };
  if (new Date(String(inv.expires_at)).getTime() <= Date.now()) return { ok: false, message: "This invitation has expired." };
  if (Number(inv.uses) >= Number(inv.max_uses)) return { ok: false, message: "This invitation has been used up." };

  const group = await groupById(db, String(inv.group_id));
  if (!group) return { ok: false, message: "That group no longer exists." };

  // Claim one use atomically: only succeeds while uses is still below the limit.
  const { data: claimed } = await db
    .from("zimamoto_invites")
    .update({ uses: Number(inv.uses) + 1 })
    .eq("id", inv.id)
    .eq("uses", Number(inv.uses))
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, message: "Please try the invitation again." };

  const { error } = await db
    .from("zimamoto_group_members")
    .upsert({ group_id: group.id, user_id: input.userId, role: "member" }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, publicId: group.public_id };
}
