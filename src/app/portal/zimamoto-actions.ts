"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import {
  createZimamotoGroup,
  createZimamotoPost,
  saveZimamotoDoc,
} from "@/lib/portal/zimamoto";
import { createInvite, joinGroup, listInvites, revokeInvite, type ZimamotoInvite } from "@/lib/portal/zimamoto-access";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { MAX_UPLOAD_BYTES, STORAGE_BUCKET } from "@/lib/workspace/constants";

import type { PortalResult } from "@/app/portal/auth-actions";

async function requireStudent() {
  const user = await getPortalUser();
  if (!user) throw new Error("Please sign in again.");
  if (isStaffUser(user)) throw new Error("This account cannot use the student portal.");
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("Service unavailable. Please try again later.");
  return { user, db };
}

function safeFileName(name: string): string {
  return (
    name
      .trim()
      .slice(0, 120)
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, "_") || "file"
  );
}

export async function portalZimamotoCreateGroupAction(input: {
  name: string;
  description: string;
  isPrivate: boolean;
}): Promise<PortalResult & { publicId?: string }> {
  try {
    const { user, db } = await requireStudent();
    const result = await createZimamotoGroup(db, {
      userId: user.id,
      name: String(input.name ?? ""),
      description: String(input.description ?? ""),
      isPrivate: input.isPrivate !== false,
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/zimamoto");
    return { ok: true, message: "Group created. Share the invite code with classmates.", publicId: result.publicId };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not create the group." };
  }
}

export async function portalZimamotoJoinGroupAction(inviteCode: string): Promise<PortalResult & { publicId?: string }> {
  try {
    const { user, db } = await requireStudent();
    const result = await joinGroup(db, { userId: user.id, code: String(inviteCode ?? "") });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/zimamoto");
    revalidatePath(`/portal/zimamoto/g/${result.publicId}`);
    return { ok: true, message: "You joined the group.", publicId: result.publicId };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not join the group." };
  }
}

export async function portalZimamotoCreateInviteAction(input: {
  groupId: string;
  maxUses?: number;
  days?: number;
}): Promise<PortalResult & { invite?: ZimamotoInvite }> {
  try {
    const { user, db } = await requireStudent();
    const res = await createInvite(db, { groupId: String(input.groupId), userId: user.id, maxUses: input.maxUses, days: input.days });
    if (!res.ok) return { ok: false, message: res.message };
    return { ok: true, message: "Invitation created.", invite: res.invite };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not create the invitation." };
  }
}

export async function portalZimamotoListInvitesAction(groupId: string): Promise<{ ok: boolean; invites: ZimamotoInvite[] }> {
  try {
    const { user, db } = await requireStudent();
    return { ok: true, invites: await listInvites(db, String(groupId), user.id) };
  } catch {
    return { ok: false, invites: [] };
  }
}

export async function portalZimamotoRevokeInviteAction(inviteId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const res = await revokeInvite(db, { inviteId: String(inviteId), userId: user.id });
    return res.ok ? { ok: true, message: "Invitation cancelled." } : { ok: false, message: res.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not cancel the invitation." };
  }
}

export async function portalZimamotoUploadUrlAction(input: {
  groupId: string | null;
  fileName: string;
  sizeBytes: number;
}): Promise<PortalResult & { path?: string; token?: string }> {
  try {
    const { db } = await requireStudent();
    const size = Number(input.sizeBytes);
    if (!Number.isFinite(size) || size <= 0) return { ok: false, message: "The file is empty." };
    if (size > MAX_UPLOAD_BYTES) return { ok: false, message: "Files can be up to 25 MB." };

    const scope = input.groupId ? String(input.groupId) : "public";
    const safe = safeFileName(String(input.fileName ?? "file"));
    const path = `zimamoto/${scope}/${randomUUID()}-${safe}`;
    const { data, error } = await db.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, message: error?.message ?? "Could not start the upload." };
    return { ok: true, message: "Upload ready.", path: data.path, token: data.token };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not prepare upload." };
  }
}

export async function portalZimamotoCreatePostAction(input: {
  groupId: string | null;
  title: string;
  body: string;
  paperPath?: string | null;
  paperFileName?: string | null;
  paperSizeBytes?: number | null;
  paperMimeType?: string | null;
}): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const paperPath = input.paperPath?.trim() || null;
    const paper =
      paperPath
        ? {
            fileName: String(input.paperFileName ?? "paper"),
            storagePath: paperPath,
            sizeBytes: Math.max(0, Number(input.paperSizeBytes) || 0),
            mimeType: input.paperMimeType ? String(input.paperMimeType) : null,
          }
        : null;

    if (paper && !paper.storagePath.startsWith("zimamoto/")) {
      return { ok: false, message: "Invalid attachment." };
    }

    const result = await createZimamotoPost(db, {
      userId: user.id,
      groupId: input.groupId,
      title: String(input.title ?? ""),
      body: String(input.body ?? ""),
      paper,
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/zimamoto");
    if (input.groupId) {
      const { data: g } = await db.from("zimamoto_groups").select("public_id").eq("id", input.groupId).maybeSingle();
      if (g?.public_id) revalidatePath(`/portal/zimamoto/g/${g.public_id}`);
    }
    return { ok: true, message: paper ? "Paper shared on Zimamoto." : "Post published." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not publish." };
  }
}

export async function portalZimamotoSaveDocAction(input: {
  groupId: string;
  title: string;
  notes: string;
  storagePath: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string | null;
}): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const result = await saveZimamotoDoc(db, {
      userId: user.id,
      groupId: String(input.groupId),
      title: String(input.title ?? ""),
      notes: String(input.notes ?? ""),
      fileName: String(input.fileName ?? "file"),
      storagePath: String(input.storagePath),
      sizeBytes: Number(input.sizeBytes) || 0,
      mimeType: input.mimeType,
    });
    if (!result.ok) return { ok: false, message: result.message };
    const { data: g } = await db.from("zimamoto_groups").select("public_id").eq("id", input.groupId).maybeSingle();
    revalidatePath("/portal/zimamoto");
    if (g?.public_id) revalidatePath(`/portal/zimamoto/g/${g.public_id}`);
    return { ok: true, message: "Document saved to your group library." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save the document." };
  }
}