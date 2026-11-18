import type { SupabaseClient } from "@supabase/supabase-js";

import { isGroupMember } from "@/lib/portal/zimamoto";

// Group chat, file history, and public-group discovery (migration 029_zimamoto_chat.sql).

export type ZimamotoMessage = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  isMine: boolean;
  fileName: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
  /** True when the attachment was removed by its uploader or the group owner. */
  fileRemoved: boolean;
  createdAt: string;
};

export type ZimamotoPublicGroup = {
  publicId: string;
  name: string;
  description: string;
  memberCount: number;
  isMember: boolean;
};

export const MAX_MESSAGE_CHARS = 4000;

const MESSAGE_SELECT = "id, group_id, author_user_id, body, file_name, storage_path, size_bytes, mime_type, created_at, deleted_at";

function missingZimamoto(message: string): boolean {
  return /zimamoto_|does not exist|schema cache/i.test(message);
}

async function profileNames(db: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await db.from("student_profiles").select("user_id, full_name").in("user_id", unique);
  for (const row of data ?? []) {
    map.set(String(row.user_id), String(row.full_name ?? "").trim() || "Student");
  }
  return map;
}

function toMessage(row: Record<string, unknown>, names: Map<string, string>, viewerId: string | null): ZimamotoMessage {
  const authorId = String(row.author_user_id);
  return {
    id: String(row.id),
    body: String(row.body ?? ""),
    authorId,
    authorName: names.get(authorId) ?? "Student",
    isMine: viewerId === authorId,
    fileName: row.file_name && !row.deleted_at ? String(row.file_name) : null,
    sizeBytes: row.size_bytes == null || row.deleted_at ? null : Number(row.size_bytes),
    mimeType: row.mime_type && !row.deleted_at ? String(row.mime_type) : null,
    fileRemoved: Boolean(row.deleted_at) && Boolean(row.storage_path),
    createdAt: String(row.created_at),
  };
}

/** Latest messages, oldest first. Caller must already have checked membership. */
export async function listGroupMessages(db: SupabaseClient, groupId: string, viewerId: string, limit = 80): Promise<ZimamotoMessage[]> {
  const { data, error } = await db
    .from("zimamoto_messages")
    .select(MESSAGE_SELECT)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (missingZimamoto(error.message)) return [];
    throw new Error(error.message);
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const names = await profileNames(db, rows.map((r) => String(r.author_user_id)));
  return rows.map((r) => toMessage(r, names, viewerId)).reverse();
}

/** Messages created after `sinceIso`, oldest first (live refresh). */
export async function listGroupMessagesSince(
  db: SupabaseClient,
  groupId: string,
  viewerId: string,
  sinceIso: string,
): Promise<ZimamotoMessage[]> {
  const { data, error } = await db
    .from("zimamoto_messages")
    .select(MESSAGE_SELECT)
    .eq("group_id", groupId)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    if (missingZimamoto(error.message)) return [];
    throw new Error(error.message);
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const names = await profileNames(db, rows.map((r) => String(r.author_user_id)));
  return rows.map((r) => toMessage(r, names, viewerId));
}

export async function createGroupMessage(
  db: SupabaseClient,
  input: {
    userId: string;
    groupId: string;
    body: string;
    file: { storagePath: string; fileName: string; sizeBytes: number; mimeType: string | null } | null;
  },
): Promise<{ ok: true; message: ZimamotoMessage } | { ok: false; message: string }> {
  if (!(await isGroupMember(db, input.groupId, input.userId))) {
    return { ok: false, message: "Join this group to send messages." };
  }
  const body = input.body.trim();
  if (!body && !input.file) return { ok: false, message: "Write a message or attach a file." };
  if (body.length > MAX_MESSAGE_CHARS) return { ok: false, message: `Messages can be up to ${MAX_MESSAGE_CHARS} characters.` };

  // Files must come from this group's upload scope, so nobody can attach another group's file.
  if (input.file && !input.file.storagePath.startsWith(`zimamoto/${input.groupId}/`)) {
    return { ok: false, message: "That file does not belong to this group." };
  }

  const { data, error } = await db
    .from("zimamoto_messages")
    .insert({
      group_id: input.groupId,
      author_user_id: input.userId,
      body,
      file_name: input.file?.fileName ?? null,
      storage_path: input.file?.storagePath ?? null,
      size_bytes: input.file?.sizeBytes ?? null,
      mime_type: input.file?.mimeType ?? null,
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not send the message." };

  const names = await profileNames(db, [input.userId]);
  return { ok: true, message: toMessage(data as Record<string, unknown>, names, input.userId) };
}

export async function getGroupMessageFile(
  db: SupabaseClient,
  messageId: string,
): Promise<{ storagePath: string; groupId: string; fileName: string } | null> {
  const { data } = await db
    .from("zimamoto_messages")
    .select("storage_path, group_id, file_name")
    .eq("id", messageId)
    .not("storage_path", "is", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data?.storage_path) return null;
  return {
    storagePath: String(data.storage_path),
    groupId: String(data.group_id),
    fileName: String(data.file_name ?? "file"),
  };
}

/** Public groups anyone signed in can discover and join. Private groups are never listed. */
export async function listPublicZimamotoGroups(db: SupabaseClient, viewerId: string | null, limit = 30): Promise<ZimamotoPublicGroup[]> {
  const { data, error } = await db
    .from("zimamoto_groups")
    .select("id, public_id, name, description")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (missingZimamoto(error.message)) return [];
    throw new Error(error.message);
  }
  const groups = (data ?? []) as Record<string, unknown>[];
  const ids = groups.map((g) => String(g.id));
  if (!ids.length) return [];

  const [{ data: members }, { data: mine }] = await Promise.all([
    db.from("zimamoto_group_members").select("group_id").in("group_id", ids),
    viewerId
      ? db.from("zimamoto_group_members").select("group_id").eq("user_id", viewerId).in("group_id", ids)
      : Promise.resolve({ data: [] as { group_id: string }[] }),
  ]);
  const counts = new Map<string, number>();
  for (const m of members ?? []) counts.set(String(m.group_id), (counts.get(String(m.group_id)) ?? 0) + 1);
  const joined = new Set((mine ?? []).map((m) => String(m.group_id)));

  return groups.map((g) => ({
    publicId: String(g.public_id),
    name: String(g.name),
    description: String(g.description ?? ""),
    memberCount: counts.get(String(g.id)) ?? 0,
    isMember: joined.has(String(g.id)),
  }));
}
