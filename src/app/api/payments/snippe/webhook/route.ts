import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
  fulfillMembershipPayment,
  fulfillInvoicePayment,
  fulfillTitleChangePayment,
  normalizeMembershipMonths,
  type DeskPlanId,
} from "@/lib/payments/fulfill";
import {
  amountsMatch,
  fetchSnippePayment,
  verifySnippeWebhook,
} from "@/lib/payments/snippe";
import {
  MAX_MEMBERSHIP_MONTHS,
  SUBSCRIPTION_MONTH_TSH,
  SUBSCRIPTION_SEMESTER_TSH,
  SUBSCRIPTION_YEAR_TSH,
} from "@/lib/portal/config";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SnippeEvent = {
  id?: string;
  type?: string;
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: { value?: number; currency?: string };
    metadata?: { order_id?: string; purpose?: string; plan?: string; months?: number | string };
    channel?: { provider?: string; type?: string };
    customer?: { phone?: string };
  };
  reference?: string;
  status?: string;
  amount?: { value?: number; currency?: string };
  metadata?: { order_id?: string; purpose?: string; plan?: string; months?: number | string };
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Reject non-POST probes. */
export async function GET() {
  return json(405, { ok: false, message: "Method not allowed." });
}

export async function POST(request: Request) {
  const db = getSupabaseAdminClient();
  if (!db) return json(503, { ok: false, message: "Database unavailable." });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 64 * 1024) {
    return json(413, { ok: false, message: "Payload too large." });
  }

  const raw = await request.text();
  const timestamp = request.headers.get("x-webhook-timestamp");
  const signature = request.headers.get("x-webhook-signature");
  const verified = verifySnippeWebhook(raw, timestamp, signature);
  if (!verified.ok) {
    return json(401, { ok: false, message: "Invalid signature.", reason: verified.reason });
  }

  let body: SnippeEvent;
  try {
    body = JSON.parse(raw) as SnippeEvent;
  } catch {
    return json(400, { ok: false, message: "Invalid JSON." });
  }

  const eventType = String(body.type ?? body.event ?? request.headers.get("x-webhook-event") ?? "")
    .trim()
    .toLowerCase();
  const eventId = String(body.id ?? "").trim() || `hash_${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
  const snippeRef = String(body.data?.reference ?? body.reference ?? "").trim();
  const orderId = String(body.data?.metadata?.order_id ?? body.metadata?.order_id ?? "").trim();
  const status = String(body.data?.status ?? body.status ?? "").toLowerCase();
  const paidAmount = body.data?.amount?.value ?? body.amount?.value ?? null;
  const currency = String(body.data?.amount?.currency ?? body.amount?.currency ?? "TZS").toUpperCase();
  const channel = body.data?.channel?.provider ? String(body.data.channel.provider) : null;
  const phone = body.data?.customer?.phone ? String(body.data.customer.phone) : null;

  // Strict: require both event type AND payload status for money movement.
  const paid = eventType === "payment.completed" && status === "completed";
  const failed =
    eventType === "payment.failed" ||
    eventType === "payment.expired" ||
    eventType === "payment.voided" ||
    status === "failed" ||
    status === "expired" ||
    status === "voided";

  if (currency && currency !== "TZS") {
    await recordWebhook(db, {
      eventId,
      eventType,
      snippeRef,
      orderId,
      paidAmount,
      currency,
      outcome: "rejected_currency",
    });
    return json(400, { ok: false, message: "Unsupported currency." });
  }

  // Idempotent receipt — duplicate deliveries return 200 without re-fulfilling.
  const inserted = await recordWebhook(db, {
    eventId,
    eventType,
    snippeRef,
    orderId,
    paidAmount,
    currency,
    outcome: "received",
  });
  // Duplicate delivery: skip only if the earlier attempt finished. If it failed or never
  // completed, let the provider's retry run fulfilment again (fulfilment is idempotent).
  if (inserted === "duplicate") {
    const prior = await priorOutcome(db, eventId);
    if (!RETRYABLE_OUTCOMES.has(prior)) {
      return json(200, { ok: true, duplicate: true });
    }
  }

  // Prefer lookup by our order_id; fall back to Snippe payment reference.
  let titlePay = orderId
    ? (
        await db
          .from("title_change_payments")
          .select("id, user_id, selection_id, status, reference, amount, provider_txn_id")
          .eq("reference", orderId)
          .maybeSingle()
      ).data
    : null;
  if (!titlePay && snippeRef) {
    titlePay = (
      await db
        .from("title_change_payments")
        .select("id, user_id, selection_id, status, reference, amount, provider_txn_id")
        .eq("provider_txn_id", snippeRef)
        .maybeSingle()
    ).data;
  }

  if (titlePay) {
    if (failed && !paid) {
      await db.from("title_change_payments").update({ status: "failed" }).eq("id", titlePay.id).eq("status", "pending");
      await markOutcome(db, eventId, "title_failed");
      return json(200, { ok: true });
    }

    if (!paid) {
      await markOutcome(db, eventId, "ignored_pending");
      return json(200, { ok: true });
    }

    if (!amountsMatch(Number(titlePay.amount), paidAmount)) {
      await markOutcome(db, eventId, "amount_mismatch");
      return json(409, { ok: false, message: "Amount mismatch." });
    }

    // Secondary check against Snippe API — blocks forged/replayed bodies that somehow signed.
    if (snippeRef) {
      const live = await fetchSnippePayment(snippeRef);
      if (!live || live.status !== "completed") {
        await markOutcome(db, eventId, "provider_status_mismatch");
        return json(409, { ok: false, message: "Provider status not completed." });
      }
      if (live.amount != null && !amountsMatch(Number(titlePay.amount), live.amount)) {
        await markOutcome(db, eventId, "provider_amount_mismatch");
        return json(409, { ok: false, message: "Provider amount mismatch." });
      }
      if (live.orderId && live.orderId !== String(titlePay.reference)) {
        await markOutcome(db, eventId, "order_id_mismatch");
        return json(409, { ok: false, message: "Order reference mismatch." });
      }
    }

    if (snippeRef) {
      await db
        .from("title_change_payments")
        .update({ provider_txn_id: snippeRef, network: channel ?? undefined })
        .eq("id", titlePay.id)
        .eq("status", "pending");
    }

    const purpose = String(body.data?.metadata?.purpose ?? body.metadata?.purpose ?? "").toLowerCase();
    const planRaw = String(body.data?.metadata?.plan ?? body.metadata?.plan ?? "").toLowerCase();
    const monthsRaw = body.data?.metadata?.months ?? body.metadata?.months ?? null;
    const isMembership =
      purpose === "membership" || String(titlePay.reference).toUpperCase().startsWith("MEM");
    let plan: DeskPlanId =
      planRaw === "semester" ? "semester" : planRaw === "monthly" ? "monthly" : "year";
    let membershipMonths: number | null = null;
    if (plan === "monthly") {
      membershipMonths = normalizeMembershipMonths("monthly", monthsRaw);
      if (!Number.isFinite(membershipMonths)) {
        await markOutcome(db, eventId, "invalid_monthly_plan");
        return json(409, { ok: false, message: "Invalid monthly membership duration in metadata." });
      }
    }
    if (isMembership && !planRaw) {
      const amt = Math.round(Number(titlePay.amount));
      if (amt === SUBSCRIPTION_SEMESTER_TSH) plan = "semester";
      else if (amt === SUBSCRIPTION_YEAR_TSH) plan = "year";
      else if (
        amt >= SUBSCRIPTION_MONTH_TSH &&
        amt % SUBSCRIPTION_MONTH_TSH === 0 &&
        amt <= SUBSCRIPTION_MONTH_TSH * MAX_MEMBERSHIP_MONTHS
      ) {
        plan = "monthly";
        membershipMonths = amt / SUBSCRIPTION_MONTH_TSH;
      }
    }

    const result = isMembership
      ? await fulfillMembershipPayment(
          db,
          {
            id: String(titlePay.id),
            user_id: String(titlePay.user_id),
            status: String(titlePay.status),
            reference: String(titlePay.reference),
            amount: Number(titlePay.amount),
          },
          plan,
          {
            paidAmount: paidAmount == null ? null : Number(paidAmount),
            providerTxnId: snippeRef || null,
            webhookEventId: eventId,
          },
          membershipMonths,
        )
      : await fulfillTitleChangePayment(
          db,
          {
            id: String(titlePay.id),
            user_id: String(titlePay.user_id),
            selection_id: titlePay.selection_id ? String(titlePay.selection_id) : null,
            status: String(titlePay.status),
            reference: String(titlePay.reference),
            amount: Number(titlePay.amount),
          },
          {
            paidAmount: paidAmount == null ? null : Number(paidAmount),
            providerTxnId: snippeRef || null,
            webhookEventId: eventId,
          },
        );
    if (!result.ok) {
      await markOutcome(db, eventId, "fulfill_error");
      return json(500, result);
    }
    await markOutcome(
      db,
      eventId,
      result.fulfilled ? (isMembership ? "membership_fulfilled" : "title_fulfilled") : "already_paid",
    );
    return json(200, { ok: true });
  }

  const invoiceRef = orderId || snippeRef;
  if (paid && invoiceRef) {
    if (paidAmount == null) {
      await markOutcome(db, eventId, "missing_amount");
      return json(400, { ok: false, message: "Missing paid amount." });
    }
    if (!snippeRef) {
      await markOutcome(db, eventId, "missing_reference");
      return json(400, { ok: false, message: "Missing payment reference." });
    }

    const live = await fetchSnippePayment(snippeRef);
    if (!live || live.status !== "completed") {
      await markOutcome(db, eventId, "provider_status_mismatch");
      return json(409, { ok: false, message: "Provider status not completed." });
    }
    if (live.amount != null && !amountsMatch(Number(paidAmount), live.amount)) {
      await markOutcome(db, eventId, "provider_amount_mismatch");
      return json(409, { ok: false, message: "Provider amount mismatch." });
    }
    // The provider's copy of the order must be the invoice this payment is applied to.
    if (live.orderId && live.orderId !== invoiceRef) {
      await markOutcome(db, eventId, "order_id_mismatch");
      return json(409, { ok: false, message: "Order reference mismatch." });
    }

    const result = await fulfillInvoicePayment(db, invoiceRef, {
      network: channel,
      phone,
      providerTxnId: snippeRef || null,
      paidAmount: Number(paidAmount),
      webhookEventId: eventId,
    });
    if (!result.ok && result.message !== "Invoice not found.") {
      await markOutcome(db, eventId, "invoice_fulfill_error");
      return json(500, result);
    }
    await markOutcome(db, eventId, result.ok ? (result.fulfilled ? "invoice_fulfilled" : "invoice_noop") : "invoice_not_found");
  } else if (failed && invoiceRef) {
    await markOutcome(db, eventId, "invoice_failed_left_unpaid");
  } else {
    await markOutcome(db, eventId, "unmatched");
  }

  return json(200, { ok: true });
}

async function recordWebhook(
  db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  row: {
    eventId: string;
    eventType: string;
    snippeRef: string;
    orderId: string;
    paidAmount: number | null;
    currency: string;
    outcome: string;
  },
): Promise<"ok" | "duplicate" | "skipped"> {
  const { error } = await db.from("payment_webhook_events").insert({
    provider: "snippe",
    event_id: row.eventId,
    event_type: row.eventType || null,
    payment_reference: row.snippeRef || null,
    order_id: row.orderId || null,
    amount_tsh: row.paidAmount == null ? null : Math.round(Number(row.paidAmount)),
    currency: row.currency || null,
    signature_ok: true,
    outcome: row.outcome,
  });
  if (!error) return "ok";
  if (/duplicate|unique|23505/i.test(error.message)) return "duplicate";
  // Table may not exist until migration 018 — continue without blocking payments.
  if (/payment_webhook_events|schema cache|relation|does not exist/i.test(error.message)) return "skipped";
  return "skipped";
}

/** Outcomes that mean the earlier attempt did not finish, so a redelivery must be processed. */
const RETRYABLE_OUTCOMES = new Set([
  "", // unknown (lookup failed): reprocess, fulfilment is idempotent
  "received",
  "fulfill_error",
  "invoice_fulfill_error",
  "provider_status_mismatch",
  "provider_amount_mismatch",
  "missing_reference",
]);

async function priorOutcome(
  db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  eventId: string,
): Promise<string> {
  try {
    const { data } = await db
      .from("payment_webhook_events")
      .select("outcome")
      .eq("provider", "snippe")
      .eq("event_id", eventId)
      .maybeSingle();
    return String(data?.outcome ?? "");
  } catch {
    return "";
  }
}

async function markOutcome(
  db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  eventId: string,
  outcome: string,
) {
  try {
    await db.from("payment_webhook_events").update({ outcome }).eq("provider", "snippe").eq("event_id", eventId);
  } catch {
    /* ignore if audit table missing */
  }
}
