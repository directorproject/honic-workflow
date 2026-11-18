import type { SupabaseClient } from "@supabase/supabase-js";

import { isGroupMember } from "@/lib/portal/zimamoto";
import { fileFamilyKey } from "@/lib/portal/zimamoto-file-utils";

export { fileFamilyKey };

// Zimamoto file library: listing, folders, pins, moves and removal (migration 030_zimamoto_files.sql).

/** Per-group storage allowance shown in the storage bar. */
export const ZIMAMOTO_GROUP_STORAGE_BYTES = 500 * 1024 * 1024;

export type ZimamotoFolder = { id: string; name: string; fileCount: number };

export type ZimamotoFile = {
  kind: "message" | "doc";
  key: string;
  folderId: string | null;
  fileName: string;
  sizeBytes: number;
  mimeType: string | null;
  uploaderName: string;
  createdAt: string;
  pinned: boolean;
  /** 1-based; the same name uploaded again becomes version 2, 3… */
  version: number;
  versionCount: number;
  canManage: boolean;
};

export type ZimamotoFileLibrary = {
  files: ZimamotoFile[];
  folders: ZimamotoFolder[];
  usedBytes: number;
  limitBytes: number;
};

async function profileNames(db: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await db.from("student_profiles").select("user_id, full_name").in("user_id", unique);
  for (const row of data ?? []) map.set(String(row.user_id), String(row.full_name ?? "").trim() || "Student");
  return map;
}

export async function loadGroupFileLibrary(db: SupabaseClient, groupId: string, viewerId: string): Promise<ZimamotoFileLibrary> {
  const [msgRes, docRes, folderRes, groupRes] = await Promise.all([
    db
      .from("zimamoto_messages")
      .select("id, author_user_id, file_name, size_bytes, mime_type, created_at, pinned, folder_id")
      .eq("group_id", groupId)
      .not("storage_path", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("zimamoto_docs")
      .select("public_id, uploader_user_id, file_name, size_bytes, mime_type, created_at, pinned, folder_id")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("zimamoto_folders").select("id, name").eq("group_id", groupId).order("name", { ascending: true }),
    db.from("zimamoto_groups").select("owner_user_id").eq("id", groupId).maybeSingle(),
  ]);
  if (msgRes.error) throw new Error(msgRes.error.message);
  if (docRes.error) throw new Error(docRes.error.message);
  if (folderRes.error) throw new Error(folderRes.error.message);

  const msgRows = (msgRes.data ?? []) as Record<string, unknown>[];
  const docRows = (docRes.data ?? []) as Record<string, unknown>[];
  const folderRows = (folderRes.data ?? []) as Record<string, unknown>[];
  const isOwner = String(groupRes.data?.owner_user_id ?? "") === viewerId;
  const names = await profileNames(db, [
    ...msgRows.map((r) => String(r.author_user_id)),
    ...docRows.map((r) => String(r.uploader_user_id)),
  ]);

  const base: Omit<ZimamotoFile, "version" | "versionCount">[] = [
    ...msgRows.map((r) => ({
      kind: "message" as const,
      key: String(r.id),
      folderId: r.folder_id ? String(r.folder_id) : null,
      fileName: String(r.file_name ?? "file"),
      sizeBytes: Number(r.size_bytes) || 0,
      mimeType: r.mime_type ? String(r.mime_type) : null,
      uploaderName: names.get(String(r.author_user_id)) ?? "Student",
      createdAt: String(r.created_at),
      pinned: Boolean(r.pinned),
      canManage: isOwner || String(r.author_user_id) === viewerId,
    })),
    ...docRows.map((r) => ({
      kind: "doc" as const,
      key: String(r.public_id),
      folderId: r.folder_id ? String(r.folder_id) : null,
      fileName: String(r.file_name ?? "file"),
      sizeBytes: Number(r.size_bytes) || 0,
      mimeType: r.mime_type ? String(r.mime_type) : null,
      uploaderName: names.get(String(r.uploader_user_id)) ?? "Student",
      createdAt: String(r.created_at),
      pinned: Boolean(r.pinned),
      canManage: isOwner || String(r.uploader_user_id) === viewerId,
    })),
  ];

  // Version numbers: oldest upload of a family is v1.
  const byFamily = new Map<string, typeof base>();
  for (const f of base) {
    const k = fileFamilyKey(f.fileName);
    byFamily.set(k, [...(byFamily.get(k) ?? []), f]);
  }
  const files: ZimamotoFile[] = [];
  for (const family of byFamily.values()) {
    const ordered = [...family].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    ordered.forEach((f, i) => files.push({ ...f, version: i + 1, versionCount: ordered.length }));
  }
  files.sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.createdAt < b.createdAt ? 1 : -1));

  const folders: ZimamotoFolder[] = folderRows.map((f) => ({
    id: String(f.id),
    name: String(f.name),
    fileCount: files.filter((x) => x.folderId === String(f.id)).length,
  }));

  return {
    files,
    folders,
    usedBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
    limitBytes: ZIMAMOTO_GROUP_STORAGE_BYTES,
  };
}

export async function createFolder(
  db: SupabaseClient,
  input: { userId: string; groupId: string; name: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await isGroupMember(db, input.groupId, input.userId))) return { ok: false, message: "Join this group first." };
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 60) return { ok: false, message: "Folder names need 1 to 60 characters." };
  const { error } = await db.from("zimamoto_folders").insert({ group_id: input.groupId, name, created_by: input.userId });
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message)) return { ok: false, message: "A folder with that name already exists." };
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

/** Pin and move a file. `folderId` null means "unfiled". */
export async function updateFileMeta(
  db: SupabaseClient,
  input: { userId: string; groupId: string; kind: "message" | "doc"; key: string; pinned?: boolean; folderId?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await isGroupMember(db, input.groupId, input.userId))) return { ok: false, message: "Join this group first." };

  if (input.folderId) {
    const { data: folder } = await db.from("zimamoto_folders").select("id").eq("id", input.folderId).eq("group_id", input.groupId).maybeSingle();
    if (!folder) return { ok: false, message: "That folder does not exist in this group." };
  }

  const patch: Record<string, unknown> = {};
  if (typeof input.pinned === "boolean") patch.pinned = input.pinned;
  if (input.folderId !== undefined) patch.folder_id = input.folderId;
  if (!Object.keys(patch).length) return { ok: true };

  const table = input.kind === "message" ? "zimamoto_messages" : "zimamoto_docs";
  const idCol = input.kind === "message" ? "id" : "public_id";
  const { data, error } = await db
    .from(table)
    .update(patch)
    .eq(idCol, input.key)
    .eq("group_id", input.groupId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "File not found." };
  return { ok: true };
}

/** Hides a file for everyone. Uploader or group owner only. The stored copy is kept. */
export async function removeFile(
  db: SupabaseClient,
  input: { userId: string; groupId: string; kind: "message" | "doc"; key: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await isGroupMember(db, input.groupId, input.userId))) return { ok: false, message: "Join this group first." };
  const { data: group } = await db.from("zimamoto_groups").select("owner_user_id").eq("id", input.groupId).maybeSingle();
  const isOwner = String(group?.owner_user_id ?? "") === input.userId;

  const table = input.kind === "message" ? "zimamoto_messages" : "zimamoto_docs";
  const idCol = input.kind === "message" ? "id" : "public_id";
  const uploaderCol = input.kind === "message" ? "author_user_id" : "uploader_user_id";

  const { data: row } = await db.from(table).select(uploaderCol).eq(idCol, input.key).eq("group_id", input.groupId).is("deleted_at", null).maybeSingle();
  if (!row) return { ok: false, message: "File not found." };
  if (!isOwner && String((row as Record<string, unknown>)[uploaderCol]) !== input.userId) {
    return { ok: false, message: "Only the uploader or the group owner can remove this file." };
  }

  const { error } = await db
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq(idCol, input.key)
    .eq("group_id", input.groupId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
