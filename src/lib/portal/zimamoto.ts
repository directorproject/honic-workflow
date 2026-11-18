import type { SupabaseClient } from "@supabase/supabase-js";

import { newPublicId } from "@/lib/portal/accounts";

export type ZimamotoGroup = {
  id: string;
  publicId: string;
  name: string;
  description: string;
  isPrivate: boolean;
  createdAt: string;
  isOwner: boolean;
  isMember: boolean;
};

export type ZimamotoPost = {
  id: string;
  publicId: string;
  groupId: string | null;
  groupPublicId: string | null;
  title: string;
  body: string;
  authorName: string;
  paperFileName: string | null;
  paperSizeBytes: number | null;
  createdAt: string;
  isMine: boolean;
  hasPaper: boolean;
};

export type ZimamotoDoc = {
  id: string;
  publicId: string;
  groupId: string;
  title: string;
  notes: string;
  fileName: string;
  sizeBytes: number;
  uploaderName: string;
  createdAt: string;
};

function missingZimamoto(message: string): boolean {
  return /zimamoto_|does not exist|schema cache/i.test(message);
}

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (base || fileName).slice(0, 200);
}

function resolveZimamotoPostTitle(rawTitle: string, body: string, paperFileName: string | null | undefined): string {
  const explicit = rawTitle.trim();
  if (explicit) return explicit.slice(0, 200);
  if (paperFileName) return titleFromFileName(paperFileName);
  if (body.trim()) return body.trim().slice(0, 80);
  return "Shared post";
}

async function profileNames(db: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const unique = [...new Set(userIds)];
  const { data } = await db.from("student_profiles").select("user_id, full_name").in("user_id", unique);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const name = String(row.full_name ?? "").trim();
    map.set(String(row.user_id), name || "Student");
  }
  return map;
}

export async function listZimamotoGroups(db: SupabaseClient, userId: string): Promise<ZimamotoGroup[]> {
  const { data: memberships, error: memErr } = await db
    .from("zimamoto_group_members")
    .select("group_id, role, zimamoto_groups ( id, public_id, name, description, is_private, owner_user_id, created_at )")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (memErr) {
    if (missingZimamoto(memErr.message)) return [];
    throw new Error(memErr.message);
  }
  const out: ZimamotoGroup[] = [];
  for (const row of memberships ?? []) {
    const g = row.zimamoto_groups as Record<string, unknown> | Record<string, unknown>[] | null;
    const group = Array.isArray(g) ? g[0] : g;
    if (!group) continue;
    out.push({
      id: String(group.id),
      publicId: String(group.public_id),
      name: String(group.name),
      description: String(group.description ?? ""),
      isPrivate: Boolean(group.is_private),
      createdAt: String(group.created_at),
      isOwner: String(group.owner_user_id) === userId,
      isMember: true,
    });
  }
  return out;
}

export async function getZimamotoGroupByPublicId(
  db: SupabaseClient,
  publicId: string,
  userId: string | null,
): Promise<(ZimamotoGroup & { memberCount: number }) | null> {
  const { data: group, error } = await db
    .from("zimamoto_groups")
    .select("id, public_id, name, description, is_private, owner_user_id, created_at")
    .eq("public_id", publicId)
    .maybeSingle();
  if (error) {
    if (missingZimamoto(error.message)) return null;
    throw new Error(error.message);
  }
  if (!group) return null;

  let isMember = false;
  let memberCount = 0;
  const { count } = await db.from("zimamoto_group_members").select("user_id", { count: "exact", head: true }).eq("group_id", group.id);
  memberCount = count ?? 0;
  if (userId) {
    const { data: mem } = await db
      .from("zimamoto_group_members")
      .select("user_id")
      .eq("group_id", group.id)
      .eq("user_id", userId)
      .maybeSingle();
    isMember = Boolean(mem);
  }

  return {
    id: String(group.id),
    publicId: String(group.public_id),
    name: String(group.name),
    description: String(group.description ?? ""),
    isPrivate: Boolean(group.is_private),
    createdAt: String(group.created_at),
    isOwner: userId === String(group.owner_user_id),
    isMember: isMember || userId === String(group.owner_user_id),
    memberCount,
  };
}

export async function listPublicZimamotoPosts(db: SupabaseClient, viewerId: string | null, limit = 40): Promise<ZimamotoPost[]> {
  const { data, error } = await db
    .from("zimamoto_posts")
    .select("id, public_id, author_user_id, group_id, title, body, paper_file_name, paper_storage_path, paper_size_bytes, created_at")
    .is("group_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (missingZimamoto(error.message)) return [];
    throw new Error(error.message);
  }
  const authors = await profileNames(
    db,
    (data ?? []).map((r) => String(r.author_user_id)),
  );
  return (data ?? []).map((row) => ({
    id: String(row.id),
    publicId: String(row.public_id),
    groupId: null,
    groupPublicId: null,
    title: String(row.title),
    body: String(row.body ?? ""),
    authorName: authors.get(String(row.author_user_id)) ?? "Student",
    paperFileName: row.paper_file_name ? String(row.paper_file_name) : null,
    paperSizeBytes: row.paper_size_bytes != null ? Number(row.paper_size_bytes) : null,
    createdAt: String(row.created_at),
    isMine: Boolean(viewerId && String(row.author_user_id) === viewerId),
    hasPaper: Boolean(row.paper_storage_path),
  }));
}

export async function listGroupZimamotoPosts(db: SupabaseClient, groupId: string, viewerId: string | null): Promise<ZimamotoPost[]> {
  const { data, error } = await db
    .from("zimamoto_posts")
    .select("id, public_id, author_user_id, group_id, title, body, paper_file_name, paper_storage_path, paper_size_bytes, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  const authors = await profileNames(
    db,
    (data ?? []).map((r) => String(r.author_user_id)),
  );
  return (data ?? []).map((row) => ({
    id: String(row.id),
    publicId: String(row.public_id),
    groupId: String(row.group_id),
    groupPublicId: null,
    title: String(row.title),
    body: String(row.body ?? ""),
    authorName: authors.get(String(row.author_user_id)) ?? "Student",
    paperFileName: row.paper_file_name ? String(row.paper_file_name) : null,
    paperSizeBytes: row.paper_size_bytes != null ? Number(row.paper_size_bytes) : null,
    createdAt: String(row.created_at),
    isMine: Boolean(viewerId && String(row.author_user_id) === viewerId),
    hasPaper: Boolean(row.paper_storage_path),
  }));
}

export async function listGroupZimamotoDocs(db: SupabaseClient, groupId: string): Promise<ZimamotoDoc[]> {
  const { data, error } = await db
    .from("zimamoto_docs")
    .select("id, public_id, group_id, uploader_user_id, title, notes, file_name, size_bytes, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const names = await profileNames(
    db,
    (data ?? []).map((r) => String(r.uploader_user_id)),
  );
  return (data ?? []).map((row) => ({
    id: String(row.id),
    publicId: String(row.public_id),
    groupId: String(row.group_id),
    title: String(row.title),
    notes: String(row.notes ?? ""),
    fileName: String(row.file_name),
    sizeBytes: Number(row.size_bytes) || 0,
    uploaderName: names.get(String(row.uploader_user_id)) ?? "Student",
    createdAt: String(row.created_at),
  }));
}

export async function isGroupMember(db: SupabaseClient, groupId: string, userId: string): Promise<boolean> {
  const { data } = await db
    .from("zimamoto_group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function createZimamotoGroup(
  db: SupabaseClient,
  input: { userId: string; name: string; description: string; isPrivate: boolean },
): Promise<{ ok: true; publicId: string } | { ok: false; message: string }> {
  const name = input.name.trim().slice(0, 120);
  const description = input.description.trim().slice(0, 2000);
  if (name.length < 3) return { ok: false, message: "Group name needs at least 3 characters." };

  const publicId = newPublicId();
  const { data: inserted, error } = await db
    .from("zimamoto_groups")
    .insert({
      public_id: publicId,
      name,
      description,
      is_private: input.isPrivate,
      owner_user_id: input.userId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    if (missingZimamoto(error.message)) {
      return { ok: false, message: "Zimamoto is not ready yet. Ask staff to run migration 027." };
    }
    return { ok: false, message: error.message };
  }

  const { error: memErr } = await db.from("zimamoto_group_members").insert({
    group_id: inserted.id,
    user_id: input.userId,
    role: "owner",
  });
  if (memErr) return { ok: false, message: memErr.message };

  return { ok: true, publicId };
}

export async function createZimamotoPost(
  db: SupabaseClient,
  input: {
    userId: string;
    groupId: string | null;
    title: string;
    body: string;
    paper?: { fileName: string; storagePath: string; sizeBytes: number; mimeType: string | null } | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.groupId) {
    const member = await isGroupMember(db, input.groupId, input.userId);
    if (!member) return { ok: false, message: "Join this group before posting." };
  }

  const body = input.body.trim().slice(0, 8000);
  const hasPaper = Boolean(input.paper?.storagePath);
  if (!hasPaper && !body && !input.title.trim()) {
    return { ok: false, message: "Attach a file or add a short note." };
  }
  const title = resolveZimamotoPostTitle(input.title, body, input.paper?.fileName);

  const { error } = await db.from("zimamoto_posts").insert({
    public_id: newPublicId(),
    author_user_id: input.userId,
    group_id: input.groupId,
    title,
    body,
    paper_file_name: input.paper?.fileName ?? null,
    paper_storage_path: input.paper?.storagePath ?? null,
    paper_size_bytes: input.paper?.sizeBytes ?? null,
    paper_mime_type: input.paper?.mimeType ?? null,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function saveZimamotoDoc(
  db: SupabaseClient,
  input: {
    userId: string;
    groupId: string;
    title: string;
    notes: string;
    fileName: string;
    storagePath: string;
    sizeBytes: number;
    mimeType: string | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const member = await isGroupMember(db, input.groupId, input.userId);
  if (!member) return { ok: false, message: "You must be in the group to save documents." };

  const title = input.title.trim() ? input.title.trim().slice(0, 200) : titleFromFileName(input.fileName);
  if (!input.storagePath.startsWith(`zimamoto/${input.groupId}/`)) {
    return { ok: false, message: "Invalid upload path." };
  }

  const { error } = await db.from("zimamoto_docs").insert({
    public_id: newPublicId(),
    group_id: input.groupId,
    uploader_user_id: input.userId,
    title,
    notes: input.notes.trim().slice(0, 2000),
    storage_path: input.storagePath,
    file_name: input.fileName,
    size_bytes: Math.max(0, Math.floor(input.sizeBytes)),
    mime_type: input.mimeType,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function getPostPaperPath(db: SupabaseClient, postPublicId: string): Promise<{ storagePath: string; groupId: string | null } | null> {
  const { data } = await db
    .from("zimamoto_posts")
    .select("paper_storage_path, group_id")
    .eq("public_id", postPublicId)
    .maybeSingle();
  if (!data?.paper_storage_path) return null;
  return {
    storagePath: String(data.paper_storage_path),
    groupId: data.group_id ? String(data.group_id) : null,
  };
}

export async function getDocByPublicId(db: SupabaseClient, docPublicId: string): Promise<{ storagePath: string; groupId: string; fileName: string } | null> {
  const { data } = await db
    .from("zimamoto_docs")
    .select("storage_path, group_id, file_name")
    .eq("public_id", docPublicId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    storagePath: String(data.storage_path),
    groupId: String(data.group_id),
    fileName: String(data.file_name),
  };
}