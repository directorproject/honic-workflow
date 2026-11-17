import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MAX_MEMBERSHIP_MONTHS,
  SUBSCRIPTION_MONTH_TSH,
  SUBSCRIPTION_SEMESTER_TSH,
  SUBSCRIPTION_YEAR_TSH,
} from "@/lib/portal/config";

export type DeskPlanId = "year" | "semester" | "monthly";

export function normalizeMembershipMonths(plan: DeskPlanId, months?: number | string | null): number {
  if (plan !== "monthly") return 0;
  const m = Math.round(Number(months));
  if (!Number.isFinite(m) || m < 1 || m > MAX_MEMBERSHIP_MONTHS) return NaN;
  return m;
}

/** @deprecated Prefer calendar extension via `computeDeskExpiresAt`. */
export function deskPlanDays(plan: DeskPlanId, months = 1): number {
  if (plan === "year") return 365;
  if (plan === "semester") return 183;
  return 30 * months;
}

export function deskPlanAmount(plan: DeskPlanId, months = 1): number {
  if (plan === "year") return SUBSCRIPTION_YEAR_TSH;
  if (plan === "semester") return SUBSCRIPTION_SEMESTER_TSH;
  const m = normalizeMembershipMonths("monthly", months);
  if (!Number.isFinite(m)) return NaN;
  return SUBSCRIPTION_MONTH_TSH * m;
}

export function computeDeskExpiresAt(baseMs: number, plan: DeskPlanId, months = 1): string {
  const base = new Date(baseMs);
  if (plan === "year") {
    base.setDate(base.getDate() + 365);
  } else if (plan === "semester") {
    base.setDate(base.getDate() + 183);
  } else {
    const m = normalizeMembershipMonths("monthly", months);
    base.setMonth(base.getMonth() + (Number.isFinite(m) ? m : 1));
  }
  return base.toISOString();
}

/**
 * Activate / extend Nexis Desk membership after a verified Snippe payment.
 * Extends from max(now, current expiry) so overlapping renewals stack safely.
 */
export async function fulfillMembershipPayment(
  db: SupabaseClient,
  payment: {
    id: string;
    user_id: string;
    status: string;
    reference: string;
    amount?: number;
  },
  plan: DeskPlanId,
  security?: {
    paidAmount?: number | null;
    providerTxnId?: string | null;
    webhookEventId?: string | null;
  },
  months?: number | null,
): Promise<{ ok: boolean; message?: string; fulfilled?: boolean }> {
  if (payment.status === "paid") return { ok: true, message: "Already paid.", fulfilled: false };

  const monthCount = plan === "monthly" ? normalizeMembershipMonths(plan, months) : 0;
  if (plan === "monthly" && !Number.isFinite(monthCount)) {
    return { ok: false, message: "Invalid monthly plan duration." };
  }

  const expected = deskPlanAmount(plan, plan === "monthly" ? monthCount : 1);
  if (payment.amount != null && Math.round(payment.amount) !== expected) {
    return { ok: false, message: "Membership amount does not match the plan. Entitlement blocked." };
  }
  if (security?.paidAmount != null && Math.round(security.paidAmount) !== expected) {
    return { ok: false, message: "Paid amount does not match the membership plan. Entitlement blocked." };
  }

  const patch: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
  };
  if (security?.providerTxnId) patch.provider_txn_id = security.providerTxnId;
  if (security?.webhookEventId) patch.webhook_event_id = security.webhookEventId;

  const { data: claimed, error: payErr } = await db
    .from("title_change_payments")
    .update(patch)
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (payErr) return { ok: false, message: payErr.message };
  if (!claimed) return { ok: true, message: "Already paid.", fulfilled: false };

  const { data: profile } = await db
    .from("student_profiles")
    .select("desk_expires_at")
    .eq("user_id", payment.user_id)
    .maybeSingle();
  if (!profile) return { ok: false, message: "Student profile missing." };

  const now = Date.now();
  const current = profile.desk_expires_at ? new Date(String(profile.desk_expires_at)).getTime() : 0;
  const base = Number.isFinite(current) && current > now ? current : now;
  const expires = computeDeskExpiresAt(
    base,
    plan,
    plan === "monthly" ? monthCount : 1,
  );

  const { error: deskErr } = await db
    .from("student_profiles")
    .update({
      desk_plan: plan,
      desk_expires_at: expires,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", payment.user_id);
  if (deskErr) return { ok: false, message: deskErr.message };

  return { ok: true, fulfilled: true };
}

/**
 * Apply a confirmed title-change payment: release the held slot and add one credit.
 * Idempotent: only the first pending→paid transition grants entitlement.
 */
export async function fulfillTitleChangePayment(
  db: SupabaseClient,
  payment: {
    id: string;
    user_id: string;
    selection_id: string | null;
    status: string;
    reference: string;
    amount?: number;
  },
  security?: {
    paidAmount?: number | null;
    providerTxnId?: string | null;
    webhookEventId?: string | null;
  },
): Promise<{ ok: boolean; message?: string; fulfilled?: boolean }> {
  if (payment.status === "paid") return { ok: true, message: "Already paid.", fulfilled: false };

  if (security?.paidAmount != null && payment.amount != null) {
    if (Math.round(security.paidAmount) !== Math.round(payment.amount)) {
      return { ok: false, message: "Paid amount does not match the order. Entitlement blocked." };
    }
  }

  const patch: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
  };
  if (security?.providerTxnId) patch.provider_txn_id = security.providerTxnId;
  if (security?.webhookEventId) patch.webhook_event_id = security.webhookEventId;

  const { data: claimed, error: payErr } = await db
    .from("title_change_payments")
    .update(patch)
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (payErr) return { ok: false, message: payErr.message };
  // Another worker already fulfilled — treat as success, do not re-grant credit.
  if (!claimed) return { ok: true, message: "Already paid.", fulfilled: false };

  const ref = String(payment.reference).toUpperCase();
  const isHidePay = ref.startsWith("HID");
  const isDocsPay = ref.startsWith("DOC");

  // Project-documents unlock: marking paid is enough (checked via DOC* paid rows).
  if (isDocsPay) {
    return { ok: true, fulfilled: true };
  }

  if (isHidePay && payment.selection_id) {
    // Pay-to-hide: protect this shortlisted title from classmates (do not release).
    await db
      .from("title_selections")
      .update({ hidden_at: new Date().toISOString() })
      .eq("id", payment.selection_id)
      .eq("user_id", payment.user_id)
      .is("released_at", null)
      .is("hidden_at", null);
    return { ok: true, fulfilled: true };
  }

  if (!isHidePay && payment.selection_id) {
    const { data: held } = await db
      .from("title_selections")
      .select("id, proposal_id")
      .eq("id", payment.selection_id)
      .eq("user_id", payment.user_id)
      .is("released_at", null)
      .maybeSingle();

    if (held) {
      await db
        .from("title_selections")
        .update({ released_at: new Date().toISOString(), release_reason: "paid_change" })
        .eq("id", held.id)
        .eq("user_id", payment.user_id)
        .is("released_at", null);

      if (held.proposal_id) {
        await db
          .from("title_proposals")
          .update({
            status: "available",
            selected_by: null,
            assigned_to: null,
            assigned_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", held.proposal_id)
          .eq("selected_by", payment.user_id);
      }
    }
  }

  // Hide credit (no selection) or change credit after release.
  const { data: profile } = await db
    .from("student_profiles")
    .select("change_credits")
    .eq("user_id", payment.user_id)
    .maybeSingle();
  if (profile) {
    await db
      .from("student_profiles")
      .update({
        change_credits: Number(profile.change_credits ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", payment.user_id);
  }

  return { ok: true, fulfilled: true };
}

export async function fulfillInvoicePayment(
  db: SupabaseClient,
  orderReference: string,
  extras: {
    network?: string | null;
    phone?: string | null;
    providerTxnId?: string | null;
    paidAmount?: number | null;
    webhookEventId?: string | null;
  },
): Promise<{ ok: boolean; message?: string; fulfilled?: boolean }> {
  const { data: inv } = await db
    .from("portal_invoices")
    .select("id, status, workspace_id, description, amount_tsh, reference")
    .eq("reference", orderReference)
    .maybeSingle();
  if (!inv) return { ok: false, message: "Invoice not found." };
  if (inv.status === "paid") return { ok: true, message: "Already paid.", fulfilled: false };
  if (inv.status !== "unpaid") return { ok: false, message: "Invoice is not awaiting payment." };

  if (extras.paidAmount != null) {
    if (Math.round(Number(extras.paidAmount)) !== Math.round(Number(inv.amount_tsh))) {
      return { ok: false, message: "Paid amount does not match the invoice. Entitlement blocked." };
    }
  }

  const { data: claimed, error } = await db
    .from("portal_invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      network: extras.network ?? null,
      phone: extras.phone ?? null,
      reference: orderReference,
      provider_txn_id: extras.providerTxnId ?? null,
      webhook_event_id: extras.webhookEventId ?? null,
    })
    .eq("id", inv.id)
    .eq("status", "unpaid")
    .select("id")
    .maybeSingle();
  if (error) {
    // Columns may not exist until migration 018 — retry without optional security columns.
    if (/provider_txn_id|webhook_event_id|schema cache|column/i.test(error.message)) {
      const { data: fallback, error: err2 } = await db
        .from("portal_invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          network: extras.network ?? null,
          phone: extras.phone ?? null,
          reference: orderReference,
        })
        .eq("id", inv.id)
        .eq("status", "unpaid")
        .select("id")
        .maybeSingle();
      if (err2) return { ok: false, message: err2.message };
      if (!fallback) return { ok: true, message: "Already paid.", fulfilled: false };
      return { ok: true, fulfilled: true };
    }
    return { ok: false, message: error.message };
  }
  if (!claimed) return { ok: true, message: "Already paid.", fulfilled: false };
  return { ok: true, fulfilled: true };
}