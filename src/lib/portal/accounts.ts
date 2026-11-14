import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { requireStaffActor } from "@/lib/auth-staff";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";

/** Opaque 64-char hex public id — never put auth.users.id in staff URLs or forms. */
export const PUBLIC_ID_RE = /^[a-f0-9]{64}$/i;
export const AUTH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function newPublicId(): string {
  return randomBytes(32).toString("hex");
}

export function isPublicId(value: string | null | undefined): boolean {
  return PUBLIC_ID_RE.test(String(value ?? "").trim());
}

export function isAuthUuid(value: string | null | undefined): boolean {
  return AUTH_UUID_RE.test(String(value ?? "").trim());
}

/** Staff pages: require staff + service-role DB (fail closed). */
export async function requireStaffDb() {
  await requireStaffActor();
  const db = getSupabaseServiceRoleClient();
  if (!db) throw new Error("Secure database access is not configured.");
  return db;
}

/** Staff RSC pages: redirect unauthenticated / non-staff to login. */
export async function requireStaffPage() {
  try {
    await requireStaffActor();
  } catch {
    redirect("/login?next=/users");
  }
  const db = getSupabaseServiceRoleClient();
  if (!db) throw new Error("Secure database access is not configured. Set SUPABASE_SERVICE_ROLE_KEY.");
  return db;
}

export async function ensurePortalAccount(db: SupabaseClient, userId: string): Promise<string> {
  const id = String(userId ?? "").trim();
  if (!isAuthUuid(id)) throw new Error("Invalid account id.");

  const { data: existing, error: readError } = await db
    .from("portal_accounts")
    .select("public_id")
    .eq("user_id", id)
    .maybeSingle();
  if (readError) {
    if (/portal_accounts|does not exist|schema cache/i.test(readError.message)) {
      throw new Error("Run supabase/v2/013_portal_accounts.sql in the Supabase SQL editor.");
    }
    throw new Error(readError.message);
  }
  if (existing?.public_id && isPublicId(String(existing.public_id))) {
    return String(existing.public_id);
  }

  const publicId = newPublicId();
  const { error } = await db.from("portal_accounts").upsert(
    { user_id: id, public_id: publicId, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return publicId;
}

export async function ensurePortalAccounts(db: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.map((id) => String(id).trim()).filter(isAuthUuid))];
  const map = new Map<string, string>();
  if (!ids.length) return map;

  const { data, error } = await db.from("portal_accounts").select("user_id, public_id").in("user_id", ids);
  if (error) {
    if (/portal_accounts|does not exist|schema cache/i.test(error.message)) {
      throw new Error("Run supabase/v2/013_portal_accounts.sql in the Supabase SQL editor.");
    }
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    if (row.public_id && isPublicId(String(row.public_id))) {
      map.set(String(row.user_id), String(row.public_id));
    }
  }

  const missing = ids.filter((id) => !map.has(id));
  if (missing.length) {
    const rows = missing.map((user_id) => ({
      user_id,
      public_id: newPublicId(),
      updated_at: new Date().toISOString(),
    }));
    const { error: insertError } = await db.from("portal_accounts").upsert(rows, { onConflict: "user_id" });
    if (insertError) throw new Error(insertError.message);
    for (const row of rows) map.set(row.user_id, row.public_id);
  }
  return map;
}

export async function resolveUserIdByPublicId(db: SupabaseClient, publicId: string): Promise<string | null> {
  const pid = String(publicId ?? "").trim().toLowerCase();
  if (!isPublicId(pid)) return null;
  const { data, error } = await db.from("portal_accounts").select("user_id").eq("public_id", pid).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.user_id ? String(data.user_id) : null;
}

/** Accept public_id (preferred) or legacy auth UUID and return { userId, publicId }. */
export async function resolveStaffUserRef(
  db: SupabaseClient,
  ref: string,
): Promise<{ userId: string; publicId: string } | null> {
  const value = String(ref ?? "").trim();
  if (isPublicId(value)) {
    const userId = await resolveUserIdByPublicId(db, value);
    if (!userId) return null;
    return { userId, publicId: value.toLowerCase() };
  }
  if (isAuthUuid(value)) {
    const publicId = await ensurePortalAccount(db, value);
    return { userId: value, publicId };
  }
  return null;
}

export async function writeStaffAudit(
  db: SupabaseClient,
  entry: {
    actorId: string;
    action: string;
    targetUserId?: string | null;
    targetPublicId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  try {
    await db.from("portal_staff_audit").insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      target_public_id: entry.targetPublicId ?? null,
      meta: entry.meta ?? {},
    });
  } catch (err) {
    console.error("writeStaffAudit:", err);
  }
}
