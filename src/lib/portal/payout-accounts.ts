import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toSnippePhone } from "@/lib/payments/snippe";
import { PAYMENT_NETWORKS } from "@/lib/portal/config";

export type PayoutAccount = {
  id: string;
  userId: string;
  claimId: string | null;
  network: string;
  phone: string;
  accountName: string;
  registeredName: string;
  status: "active" | "locked" | "revoked" | string;
  integrityHash: string;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sealOk: boolean;
};

export function normalizePersonName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Account holder name must match the registered portal profile name. */
export function payoutNameMatchesRegistered(registeredName: string, accountName: string): boolean {
  const a = normalizePersonName(registeredName);
  const b = normalizePersonName(accountName);
  if (!a || !b) return false;
  return a === b;
}

export function sealPayoutAccount(parts: {
  userId: string;
  accountName: string;
  phone: string;
  network: string;
  registeredName: string;
}): string {
  const body = [
    parts.userId,
    normalizePersonName(parts.accountName),
    parts.phone.replace(/\s+/g, ""),
    parts.network.trim().toLowerCase(),
    normalizePersonName(parts.registeredName),
  ].join("|");
  return createHash("sha256").update(body).digest("hex");
}

function asAccount(row: Record<string, unknown>): PayoutAccount {
  const accountName = String(row.account_name ?? "");
  const registeredName = String(row.registered_name ?? "");
  const phone = String(row.phone ?? "");
  const network = String(row.network ?? "");
  const userId = String(row.user_id ?? "");
  const expected = sealPayoutAccount({
    userId,
    accountName,
    phone,
    network,
    registeredName,
  });
  const integrityHash = String(row.integrity_hash ?? "");
  return {
    id: String(row.id),
    userId,
    claimId: row.claim_id ? String(row.claim_id) : null,
    network,
    phone,
    accountName,
    registeredName,
    status: String(row.status ?? "active"),
    integrityHash,
    lockedAt: row.locked_at ? String(row.locked_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    sealOk: integrityHash === expected,
  };
}

export async function loadPayoutAccount(db: SupabaseClient, userId: string): Promise<PayoutAccount | null> {
  const { data, error } = await db.from("portal_payout_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    if (/portal_payout_accounts|does not exist|schema cache/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return asAccount(data as Record<string, unknown>);
}

export async function userHasConfirmedClaim(
  db: SupabaseClient,
  userId: string,
): Promise<{ ok: true; claimId: string } | { ok: false; reason: string }> {
  const { data, error } = await db
    .from("portal_title_claims")
    .select("id")
    .eq("requester_id", userId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (/portal_title_claims|does not exist|schema cache/i.test(error.message)) {
      return { ok: false, reason: "Ownership claims are not ready yet. Contact Help desk." };
    }
    return { ok: false, reason: error.message };
  }
  if (!data?.id) {
    return {
      ok: false,
      reason: "Payout accounts open only after a title claim is confirmed by admin. Contact Help desk if you believe this is wrong.",
    };
  }
  return { ok: true, claimId: String(data.id) };
}

export function validatePayoutInput(input: {
  network: string;
  phone: string;
  accountName: string;
  registeredName: string;
}): { ok: true; network: string; phone: string; accountName: string } | { ok: false; message: string } {
  const network = String(input.network ?? "").trim();
  if (!(PAYMENT_NETWORKS as readonly string[]).includes(network)) {
    return { ok: false, message: "Choose a supported mobile-money network." };
  }
  const phoneRaw = String(input.phone ?? "").replace(/\s+/g, "");
  const phone = toSnippePhone(phoneRaw) ?? "";
  if (!phone) {
    return { ok: false, message: "Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX)." };
  }
  const accountName = String(input.accountName ?? "").replace(/\s+/g, " ").trim();
  if (accountName.length < 3) {
    return { ok: false, message: "Enter the account holder name exactly as registered on this portal." };
  }
  if (!payoutNameMatchesRegistered(input.registeredName, accountName)) {
    return {
      ok: false,
      message:
        "Account holder name must match your registered portal name exactly. If your SIM is registered under a different name, contact Help desk. Do not try to change or spoof the name.",
    };
  }
  return { ok: true, network, phone: phoneRaw.startsWith("0") ? phoneRaw : phone.replace(/^255/, "0"), accountName };
}

export async function upsertPayoutAccount(
  db: SupabaseClient,
  input: {
    userId: string;
    claimId: string;
    network: string;
    phone: string;
    accountName: string;
    registeredName: string;
  },
): Promise<{ ok: true; account: PayoutAccount } | { ok: false; message: string }> {
  const existing = await loadPayoutAccount(db, input.userId);
  if (existing && !existing.sealOk) {
    return {
      ok: false,
      message: "This payout account failed the integrity check. Contact Help desk. Do not edit it yourself.",
    };
  }
  if (existing && existing.status === "locked") {
    return {
      ok: false,
      message: "Your payout account is locked for security. Contact Help desk to change the number or name.",
    };
  }
  if (existing && existing.status === "revoked") {
    return {
      ok: false,
      message: "Your payout account was revoked. Contact Help desk.",
    };
  }
  // After first save, phone/name changes require Help desk (lock on update attempt of different phone).
  if (existing) {
    const samePhone = existing.phone.replace(/\s+/g, "") === input.phone.replace(/\s+/g, "");
    const sameNetwork = existing.network === input.network;
    const sameName = normalizePersonName(existing.accountName) === normalizePersonName(input.accountName);
    if (!samePhone || !sameNetwork || !sameName) {
      await db
        .from("portal_payout_accounts")
        .update({ status: "locked", locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .eq("user_id", input.userId);
      return {
        ok: false,
        message:
          "Changing a saved payout number or name is blocked to prevent tampering. Your account is locked. Contact Help desk.",
      };
    }
    return { ok: true, account: existing };
  }

  const integrityHash = sealPayoutAccount({
    userId: input.userId,
    accountName: input.accountName,
    phone: input.phone,
    network: input.network,
    registeredName: input.registeredName,
  });

  const { data, error } = await db
    .from("portal_payout_accounts")
    .insert({
      user_id: input.userId,
      claim_id: input.claimId,
      network: input.network,
      phone: input.phone,
      account_name: input.accountName,
      registered_name: input.registeredName,
      status: "active",
      integrity_hash: integrityHash,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    if (/portal_payout_accounts|does not exist|schema cache/i.test(error.message)) {
      return { ok: false, message: "Payout storage is not ready yet. Ask staff to apply migration 021." };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true, account: asAccount(data as Record<string, unknown>) };
}
