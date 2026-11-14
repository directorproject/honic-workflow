import type { SupabaseClient } from "@supabase/supabase-js";

import { PENDING_PAYMENT_TTL_MS } from "@/lib/portal/config";

/** Default / fallback expiry when the provider does not return expires_at. */
export function defaultPendingExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + PENDING_PAYMENT_TTL_MS).toISOString();
}

export function resolvePendingExpiresAt(providerExpiresAt?: string | null, from: Date = new Date()): string {
  if (providerExpiresAt) {
    const t = new Date(providerExpiresAt).getTime();
    if (Number.isFinite(t) && t > from.getTime()) return new Date(t).toISOString();
  }
  return defaultPendingExpiresAt(from);
}

export function isPendingExpired(input: {
  status: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  now?: number;
}): boolean {
  if (String(input.status).toLowerCase() !== "pending") return false;
  const now = input.now ?? Date.now();
  if (input.expiresAt) {
    const t = new Date(input.expiresAt).getTime();
    if (Number.isFinite(t)) return t <= now;
  }
  if (input.createdAt) {
    const t = new Date(input.createdAt).getTime();
    if (Number.isFinite(t)) return t + PENDING_PAYMENT_TTL_MS <= now;
  }
  return false;
}

/** Mark stale pending rows failed so a new prompt can be started. */
export async function expireStalePendingPayments(
  db: SupabaseClient,
  filter: { userId: string; paymentId?: string; referencePrefix?: string; selectionId?: string },
): Promise<void> {
  const nowIso = new Date().toISOString();
  let q = db
    .from("title_change_payments")
    .update({ status: "failed" })
    .eq("user_id", filter.userId)
    .eq("status", "pending")
    .lt("expires_at", nowIso);
  if (filter.paymentId) q = q.eq("id", filter.paymentId);
  if (filter.selectionId) q = q.eq("selection_id", filter.selectionId);
  if (filter.referencePrefix) q = q.ilike("reference", `${filter.referencePrefix}%`);
  const { error } = await q;
  if (error && /expires_at|column|schema cache|does not exist/i.test(error.message)) {
    // Column missing: fall back to created_at age.
    const cutoff = new Date(Date.now() - PENDING_PAYMENT_TTL_MS).toISOString();
    let q2 = db
      .from("title_change_payments")
      .update({ status: "failed" })
      .eq("user_id", filter.userId)
      .eq("status", "pending")
      .lt("created_at", cutoff);
    if (filter.paymentId) q2 = q2.eq("id", filter.paymentId);
    if (filter.selectionId) q2 = q2.eq("selection_id", filter.selectionId);
    if (filter.referencePrefix) q2 = q2.ilike("reference", `${filter.referencePrefix}%`);
    await q2;
  }
}
