"use server";

import type { PortalResult } from "@/app/portal/auth-actions";
import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { isGroupMember } from "@/lib/portal/zimamoto";
import {
  createGroupMessage,
  listGroupMessagesSince,
  MAX_MESSAGE_CHARS,
  type ZimamotoMessage,
} from "@/lib/portal/zimamoto-chat";
import {
  createFolder,
  loadGroupFileLibrary,
  removeFile,
  updateFileMeta,
  type ZimamotoFileLibrary,
} from "@/lib/portal/zimamoto-files";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { MAX_UPLOAD_BYTES } from "@/lib/workspace/constants";

async function requireStudent() {
  const user = await getPortalUser();
  if (!user) throw new Error("Please sign in again.");
  if (isStaffUser(user)) throw new Error("This account cannot use the student portal.");
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("Service unavailable. Please try again later.");
  return { user, db };
}

export async function portalZimamotoSendMessageAction(input: {
  groupId: string;
  body: string;
  file?: { storagePath: string; fileName: string; sizeBytes: number; mimeType: string | null } | null;
}): Promise<PortalResult & { chatMessage?: ZimamotoMessage }> {
  try {
    const { user, db } = await requireStudent();
    const body = String(input.body ?? "");
    if (body.trim().length > MAX_MESSAGE_CHARS) {
      return { ok: false, message: `Messages can be up to ${MAX_MESSAGE_CHARS} characters.` };
    }
    let file: { storagePath: string; fileName: string; sizeBytes: number; mimeType: string | null } | null = null;
    if (input.file) {
      const size = Number(input.file.sizeBytes);
      if (!Number.isFinite(size) || size <= 0) return { ok: false, message: "The file is empty." };
      if (size > MAX_UPLOAD_BYTES) return { ok: false, message: "Files can be up to 25 MB." };
      file = {
        storagePath: String(input.file.storagePath ?? ""),
        fileName: String(input.file.fileName ?? "file").slice(0, 200),
        sizeBytes: size,
        mimeType: input.file.mimeType ? String(input.file.mimeType) : null,
      };
    }
    const result = await createGroupMessage(db, { userId: user.id, groupId: String(input.groupId), body, file });
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, message: "Sent.", chatMessage: result.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not send." };
  }
}

/** Messages after the last one the client has. Returns [] for non-members. */
export async function portalZimamotoMessagesSinceAction(input: {
  groupId: string;
  sinceIso: string;
}): Promise<{ ok: boolean; messages: ZimamotoMessage[] }> {
  try {
    const { user, db } = await requireStudent();
    const groupId = String(input.groupId);
    if (!(await isGroupMember(db, groupId, user.id))) return { ok: true, messages: [] };
    const since = Number.isNaN(Date.parse(input.sinceIso)) ? new Date(0).toISOString() : input.sinceIso;
    const messages = await listGroupMessagesSince(db, groupId, user.id, since);
    return { ok: true, messages };
  } catch {
    return { ok: false, messages: [] };
  }
}

/** Full file library for a group: files, folders, versions, and storage use. Members only. */
export async function portalZimamotoFilesAction(
  groupId: string,
): Promise<{ ok: boolean; library?: ZimamotoFileLibrary; message?: string }> {
  try {
    const { user, db } = await requireStudent();
    const id = String(groupId);
    if (!(await isGroupMember(db, id, user.id))) return { ok: false, message: "Join this group to see its files." };
    return { ok: true, library: await loadGroupFileLibrary(db, id, user.id) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not load files." };
  }
}

export async function portalZimamotoCreateFolderAction(input: { groupId: string; name: string }): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const res = await createFolder(db, { userId: user.id, groupId: String(input.groupId), name: String(input.name ?? "") });
    return res.ok ? { ok: true, message: "Folder created." } : { ok: false, message: res.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not create the folder." };
  }
}

export async function portalZimamotoFileUpdateAction(input: {
  groupId: string;
  kind: "message" | "doc";
  key: string;
  pinned?: boolean;
  folderId?: string | null;
}): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const res = await updateFileMeta(db, {
      userId: user.id,
      groupId: String(input.groupId),
      kind: input.kind,
      key: String(input.key),
      pinned: input.pinned,
      folderId: input.folderId,
    });
    return res.ok ? { ok: true, message: "Saved." } : { ok: false, message: res.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update the file." };
  }
}

export async function portalZimamotoFileRemoveAction(input: { groupId: string; kind: "message" | "doc"; key: string }): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const res = await removeFile(db, { userId: user.id, groupId: String(input.groupId), kind: input.kind, key: String(input.key) });
    return res.ok ? { ok: true, message: "File removed." } : { ok: false, message: res.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not remove the file." };
  }
}
