import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { newPublicId } from "@/lib/portal/accounts";
import {
  ESCROW_DELIVERY_HOURS,
  ESCROW_FINAL_MAX_BYTES,
  ESCROW_FINAL_MIME,
  ESCROW_MAX_REVISIONS,
  ESCROW_PREVIEW_MAX_BYTES,
  ESCROW_PREVIEW_MIME,
  ESCROW_REVIEW_HOURS,
  ESCROW_REVISION_EXTRA_HOURS,
  escrowStatusLabel,
  type DeliverableKind,
  type EscrowActorRole,
  type EscrowStatus,
  type JobPayoutStatus,
  type PortalJobDeliverableMeta,
  type PortalJobEscrow,
  type PortalJobEscrowEvent,
  type StaffEscrowQueueItem,
  type StaffPayoutQueueItem,
} from "@/lib/portal/job-escrow-shared";
import {
  normalizePersonName,
  payoutNameMatchesRegistered,
  sealPayoutAccount,
} from "@/lib/portal/payout-accounts";
import { PAYMENT_NETWORKS } from "@/lib/portal/config";
import { fetchSnippePayment, snippeConfigured, toSnippePhone } from "@/lib/payments/snippe";

export {
  ESCROW_DELIVERY_HOURS,
  ESCROW_FINAL_MAX_BYTES,
  ESCROW_FINAL_MIME,
  ESCROW_MAX_REVISIONS,
  ESCROW_PREVIEW_MAX_BYTES,
  ESCROW_PREVIEW_MIME,
  ESCROW_REVIEW_HOURS,
  ESCROW_REVISION_EXTRA_HOURS,
  escrowStatusLabel,
};
export type {
  DeliverableKind,
  EscrowActorRole,
  EscrowStatus,
  JobPayoutStatus,
  PortalJobDeliverableMeta,
  PortalJobEscrow,
  PortalJobEscrowEvent,
};

function missingEscrow(message: string): boolean {
  return /portal_job_escrows|portal_job_deliverables|portal_job_preview_sessions|portal_peer_payout_accounts|portal_job_payouts|portal_job_escrow_events|does not exist|schema cache/i.test(
    message,
  );
}

async function logEscrowEvent(
  db: SupabaseClient,
  input: {
    escrowId: string;
    eventType: string;
    actorRole: EscrowActorRole;
    message: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("portal_job_escrow_events").insert({
    public_id: newPublicId(),
    escrow_id: input.escrowId,
    event_type: input.eventType,
    actor_role: input.actorRole,
    message: input.message.slice(0, 500),
    meta: input.meta ?? {},
  });
  if (error && !missingEscrow(error.message)) {
    console.warn("[peer-help] activity log failed", error.message);
  }
}

function sealSecret(): string {
  return (
    process.env.JOB_ESCROW_SEAL_SECRET?.trim() ||
    process.env.SNIPPE_WEBHOOK_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "honic-job-escrow-dev-seal"
  );
}

export function sealEscrowRow(parts: {
  jobId: string;
  /** Empty while money is locked but no helper is picked yet. */
  applicationId: string | null;
  posterUserId: string;
  helperUserId: string | null;
  amountTsh: number;
}): string {
  const body = [
    parts.jobId,
    parts.applicationId ?? "",
    parts.posterUserId,
    parts.helperUserId ?? "",
    String(Math.round(parts.amountTsh)),
  ].join("|");
  return createHmac("sha256", sealSecret()).update(body).digest("hex");
}

function sealPayoutRow(parts: {
  escrowId: string;
  helperUserId: string;
  amountTsh: number;
  phone: string;
  network: string;
}): string {
  const body = [
    parts.escrowId,
    parts.helperUserId,
    String(Math.round(parts.amountTsh)),
    parts.phone.replace(/\s+/g, ""),
    parts.network.trim().toLowerCase(),
  ].join("|");
  return createHmac("sha256", sealSecret()).update(body).digest("hex");
}

function asEscrow(row: Record<string, unknown>, viewerId: string | null): PortalJobEscrow {
  return {
    id: String(row.id),
    publicId: String(row.public_id ?? ""),
    jobId: String(row.job_id ?? ""),
    applicationId: String(row.application_id ?? ""),
    amountTsh: Number(row.amount_tsh) || 0,
    status: String(row.status ?? "awaiting_funds") as EscrowStatus,
    paymentReference: row.payment_reference ? String(row.payment_reference) : null,
    lockedAt: row.locked_at ? String(row.locked_at) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    deliveryDeadlineAt: row.delivery_deadline_at ? String(row.delivery_deadline_at) : null,
    reviewDeadlineAt: row.review_deadline_at ? String(row.review_deadline_at) : null,
    releasedAt: row.released_at ? String(row.released_at) : null,
    refundedAt: row.refunded_at ? String(row.refunded_at) : null,
    disputeReason: row.dispute_reason ? String(row.dispute_reason) : null,
    disputeOpenedAt: row.dispute_opened_at ? String(row.dispute_opened_at) : null,
    revisionNote: row.revision_note ? String(row.revision_note) : null,
    revisionRequestedAt: row.revision_requested_at ? String(row.revision_requested_at) : null,
    revisionCount: Math.max(0, Number(row.revision_count) || 0),
    isPoster: Boolean(viewerId && String(row.poster_user_id) === viewerId),
    isHelper: Boolean(viewerId && String(row.helper_user_id) === viewerId),
  };
}

function asDeliverable(row: Record<string, unknown>): PortalJobDeliverableMeta {
  return {
    id: String(row.id),
    publicId: String(row.public_id ?? ""),
    kind: String(row.kind) as DeliverableKind,
    mimeType: String(row.mime_type ?? ""),
    byteSize: Number(row.byte_size) || 0,
    originalName: String(row.original_name ?? "file"),
    createdAt: String(row.created_at),
  };
}

export async function getEscrowForJob(
  db: SupabaseClient,
  jobId: string,
  viewerId: string | null,
): Promise<PortalJobEscrow | null> {
  const { data, error } = await db.from("portal_job_escrows").select("*").eq("job_id", jobId).maybeSingle();
  if (error) {
    if (missingEscrow(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  // viewerId null = staff/admin load (no party flags).
  if (
    viewerId &&
    String(row.poster_user_id) !== viewerId &&
    String(row.helper_user_id) !== viewerId
  ) {
    return null;
  }
  return asEscrow(row, viewerId);
}

/** Staff: load escrow without being poster/helper. */
export async function getEscrowForJobStaff(
  db: SupabaseClient,
  jobId: string,
): Promise<PortalJobEscrow | null> {
  const { data, error } = await db.from("portal_job_escrows").select("*").eq("job_id", jobId).maybeSingle();
  if (error) {
    if (missingEscrow(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return asEscrow(data as Record<string, unknown>, null);
}

export async function listDeliverablesForEscrow(
  db: SupabaseClient,
  escrowId: string,
): Promise<PortalJobDeliverableMeta[]> {
  const { data, error } = await db
    .from("portal_job_deliverables")
    .select("id, public_id, kind, mime_type, byte_size, original_name, created_at")
    .eq("escrow_id", escrowId)
    .order("created_at", { ascending: true });
  if (error) {
    if (missingEscrow(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => asDeliverable(row as Record<string, unknown>));
}

/** Poster locks money for the request before picking anyone (amount = job offer). */
export async function createEscrowForJob(
  db: SupabaseClient,
  input: { posterUserId: string; jobPublicId: string },
): Promise<
  | { ok: true; escrow: PortalJobEscrow; amountTsh: number; jobPublicId: string }
  | { ok: false; message: string }
> {
  const { data: job } = await db
    .from("portal_jobs")
    .select("id, public_id, poster_user_id, offer_tsh, status")
    .eq("public_id", input.jobPublicId)
    .maybeSingle();
  if (!job) return { ok: false, message: "Request not found." };
  if (String(job.poster_user_id) !== input.posterUserId) {
    return { ok: false, message: "Only the poster can lock money for this request." };
  }
  if (String(job.status) !== "open") return { ok: false, message: "This request is no longer open." };

  const amount = Math.round(Number(job.offer_tsh));
  if (!Number.isFinite(amount) || amount < 500) {
    return { ok: false, message: "The offer must be at least TSh 500 to lock with mobile money. Edit the request price first." };
  }
  const integrity = sealEscrowRow({
    jobId: String(job.id),
    applicationId: null,
    posterUserId: input.posterUserId,
    helperUserId: null,
    amountTsh: amount,
  });
  const needsMigration = (message: string) =>
    /null value|not-null|violates check constraint/i.test(message)
      ? "Escrow storage needs an update. Ask staff to apply migration 043."
      : message;

  const { data: existing } = await db
    .from("portal_job_escrows")
    .select("id, status")
    .eq("job_id", job.id)
    .maybeSingle();
  if (existing) {
    const st = String(existing.status);
    if (st === "cancelled" || st === "refunded") {
      await db.from("portal_job_escrows").delete().eq("id", existing.id);
    } else if (st === "awaiting_funds") {
      // Reuse the unpaid row for a fresh prompt.
      const { error: upErr } = await db
        .from("portal_job_escrows")
        .update({
          application_id: null,
          helper_user_id: null,
          amount_tsh: amount,
          integrity_hash: integrity,
          payment_id: null,
          payment_reference: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("status", "awaiting_funds");
      if (upErr) return { ok: false, message: needsMigration(upErr.message) };
      const esc = await getEscrowForJob(db, String(job.id), input.posterUserId);
      if (!esc) return { ok: false, message: "Could not reopen escrow. Refresh and try again." };
      return { ok: true, escrow: esc, amountTsh: amount, jobPublicId: String(job.public_id) };
    } else if (st === "funded") {
      return { ok: false, message: "Your money is already locked. Pick a helper in Chats." };
    } else {
      return { ok: false, message: "A helper is already working on this request." };
    }
  }

  const { data: inserted, error: insErr } = await db
    .from("portal_job_escrows")
    .insert({
      public_id: newPublicId(),
      job_id: job.id,
      application_id: null,
      helper_user_id: null,
      poster_user_id: input.posterUserId,
      amount_tsh: amount,
      status: "awaiting_funds",
      review_hours: ESCROW_REVIEW_HOURS,
      integrity_hash: integrity,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (insErr) {
    if (missingEscrow(insErr.message) && !/null value|not-null/i.test(insErr.message)) {
      return { ok: false, message: "Escrow storage is not ready. Ask staff to apply migration 036." };
    }
    return { ok: false, message: needsMigration(insErr.message) };
  }
  return {
    ok: true,
    escrow: asEscrow(inserted as Record<string, unknown>, input.posterUserId),
    amountTsh: amount,
    jobPublicId: String(job.public_id),
  };
}

/** Poster picks a helper after money is locked: assign, start the delivery clock, close other offers. */
export async function pickHelperForFundedEscrow(
  db: SupabaseClient,
  input: { posterUserId: string; applicationPublicId: string },
): Promise<
  | {
      ok: true;
      amountTsh: number;
      jobId: string;
      jobPublicId: string;
      jobTitle: string;
      applicationId: string;
      helperUserId: string;
    }
  | { ok: false; message: string }
> {
  const { data: app } = await db
    .from("portal_job_applications")
    .select("id, job_id, applicant_user_id, status")
    .eq("public_id", input.applicationPublicId)
    .maybeSingle();
  if (!app) return { ok: false, message: "Offer not found." };
  if (String(app.status) !== "pending") return { ok: false, message: "This offer is no longer open." };

  const { data: job } = await db
    .from("portal_jobs")
    .select("id, public_id, title, poster_user_id, status")
    .eq("id", app.job_id)
    .maybeSingle();
  if (!job || String(job.poster_user_id) !== input.posterUserId) {
    return { ok: false, message: "Only the poster can pick a helper." };
  }
  // open = still on the board; assigned = already marked taken after money lock (no helper yet).
  const jobStatus = String(job.status);
  if (jobStatus !== "open" && jobStatus !== "assigned") {
    return { ok: false, message: "This request is no longer open." };
  }
  if (String(app.applicant_user_id) === input.posterUserId) {
    return { ok: false, message: "You can't pick yourself as the helper." };
  }

  const { data: escrow } = await db.from("portal_job_escrows").select("*").eq("job_id", job.id).maybeSingle();
  if (!escrow) return { ok: false, message: "Lock your money first, then pick a helper." };
  const st = String(escrow.status);
  if (st === "awaiting_funds") {
    return { ok: false, message: "Your payment is still confirming. Approve the prompt on your phone, then try again." };
  }
  if (st === "cancelled" || st === "refunded") return { ok: false, message: "Lock your money first, then pick a helper." };
  if (st !== "funded" || escrow.application_id) {
    return { ok: false, message: "A helper is already picked for this request." };
  }

  const amount = Math.round(Number(escrow.amount_tsh));
  const heldSeal = sealEscrowRow({
    jobId: String(job.id),
    applicationId: null,
    posterUserId: input.posterUserId,
    helperUserId: null,
    amountTsh: amount,
  });
  if (String(escrow.integrity_hash) !== heldSeal) {
    return { ok: false, message: "Escrow check failed. Contact Help desk before picking." };
  }

  const now = new Date().toISOString();
  const integrity = sealEscrowRow({
    jobId: String(job.id),
    applicationId: String(app.id),
    posterUserId: input.posterUserId,
    helperUserId: String(app.applicant_user_id),
    amountTsh: amount,
  });
  // Conditional update: two quick taps (or two tabs) can only pick once.
  const { data: claimed, error: escErr } = await db
    .from("portal_job_escrows")
    .update({
      application_id: app.id,
      helper_user_id: app.applicant_user_id,
      integrity_hash: integrity,
      status: "locked",
      delivery_deadline_at: new Date(Date.now() + ESCROW_DELIVERY_HOURS * 3600 * 1000).toISOString(),
      updated_at: now,
    })
    .eq("id", escrow.id)
    .eq("status", "funded")
    .is("application_id", null)
    .select("id")
    .maybeSingle();
  if (escErr) return { ok: false, message: escErr.message };
  if (!claimed) return { ok: false, message: "A helper was just picked. Refresh the page." };

  await db
    .from("portal_job_applications")
    .update({ status: "rejected", updated_at: now })
    .eq("job_id", job.id)
    .eq("status", "pending")
    .neq("id", app.id);
  await db.from("portal_job_applications").update({ status: "accepted", updated_at: now }).eq("id", app.id);
  await db
    .from("portal_jobs")
    .update({ status: "assigned", assigned_application_id: app.id, updated_at: now })
    .eq("id", job.id);

  await logEscrowEvent(db, {
    escrowId: String(escrow.id),
    eventType: "helper_picked",
    actorRole: "poster",
    message: `Helper picked. They have ~${ESCROW_DELIVERY_HOURS}h to upload preview + final.`,
  });

  return {
    ok: true,
    amountTsh: amount,
    jobId: String(job.id),
    jobPublicId: String(job.public_id),
    jobTitle: String(job.title ?? ""),
    applicationId: String(app.id),
    helperUserId: String(app.applicant_user_id),
  };
}

/** After Snippe (or simulated) payment: lock funds, accept helper, assign job. */
/**
 * If escrow is still awaiting_funds but Snippe already completed the payment
 * (missed webhook / dead tunnel), confirm with Snippe and fulfill.
 */
export async function reconcileAwaitingJobEscrow(
  db: SupabaseClient,
  input: { jobId: string; viewerUserId: string },
): Promise<{ ok: boolean; fulfilled?: boolean; message?: string }> {
  if (!snippeConfigured()) return { ok: true, fulfilled: false };

  const { data: escrow } = await db
    .from("portal_job_escrows")
    .select("id, status, payment_id, payment_reference, poster_user_id")
    .eq("job_id", input.jobId)
    .maybeSingle();
  if (!escrow) return { ok: true, fulfilled: false };
  if (String(escrow.status) !== "awaiting_funds") return { ok: true, fulfilled: false };
  if (String(escrow.poster_user_id) !== input.viewerUserId) return { ok: true, fulfilled: false };
  if (!escrow.payment_id) return { ok: true, fulfilled: false };

  const { data: pay } = await db
    .from("title_change_payments")
    .select("id, user_id, status, reference, amount, provider_txn_id")
    .eq("id", escrow.payment_id)
    .maybeSingle();
  if (!pay) return { ok: true, fulfilled: false };

  const st = String(pay.status);
  if (st === "paid") {
    // Payment row paid but escrow still awaiting — finish the fund step.
    return fulfillJobEscrowPayment(
      db,
      {
        id: String(pay.id),
        user_id: String(pay.user_id),
        status: "pending",
        reference: String(pay.reference),
        amount: Number(pay.amount),
      },
      { paidAmount: Number(pay.amount), providerTxnId: pay.provider_txn_id ? String(pay.provider_txn_id) : null },
    );
  }
  if (st !== "pending" && st !== "failed") return { ok: true, fulfilled: false };

  const snippeRef = pay.provider_txn_id ? String(pay.provider_txn_id) : "";
  if (!snippeRef) return { ok: true, fulfilled: false };

  const live = await fetchSnippePayment(snippeRef);
  if (!live) return { ok: true, fulfilled: false, message: "Could not reach payment provider." };
  if (live.status !== "completed") return { ok: true, fulfilled: false };
  if (live.amount != null && Math.round(live.amount) !== Math.round(Number(pay.amount))) {
    return { ok: false, message: "Paid amount does not match escrow." };
  }
  if (live.orderId && live.orderId !== String(pay.reference)) {
    return { ok: false, message: "Payment order mismatch." };
  }

  return fulfillJobEscrowPayment(
    db,
    {
      id: String(pay.id),
      user_id: String(pay.user_id),
      status: st,
      reference: String(pay.reference),
      amount: Number(pay.amount),
    },
    { paidAmount: live.amount, providerTxnId: snippeRef, webhookEventId: null },
  );
}

export async function fulfillJobEscrowPayment(
  db: SupabaseClient,
  payment: {
    id: string;
    user_id: string;
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

  const { data: escrow } = await db
    .from("portal_job_escrows")
    .select("*")
    .eq("payment_id", payment.id)
    .maybeSingle();
  if (!escrow) {
    // Fallback: match by payment_reference
    const byRef = await db
      .from("portal_job_escrows")
      .select("*")
      .eq("payment_reference", payment.reference)
      .maybeSingle();
    if (!byRef.data) return { ok: false, message: "Escrow not found for this payment." };
    return fulfillLockedEscrow(db, byRef.data as Record<string, unknown>, payment, security);
  }
  return fulfillLockedEscrow(db, escrow as Record<string, unknown>, payment, security);
}

async function fulfillLockedEscrow(
  db: SupabaseClient,
  escrow: Record<string, unknown>,
  payment: {
    id: string;
    user_id: string;
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
  if (String(escrow.poster_user_id) !== payment.user_id) {
    return { ok: false, message: "Payment user does not match escrow poster." };
  }
  const expected = Math.round(Number(escrow.amount_tsh));
  if (payment.amount != null && Math.round(payment.amount) !== expected) {
    return { ok: false, message: "Escrow amount does not match payment." };
  }
  if (security?.paidAmount != null && Math.round(security.paidAmount) !== expected) {
    return { ok: false, message: "Paid amount does not match escrow. Lock blocked." };
  }

  const expectedSeal = sealEscrowRow({
    jobId: String(escrow.job_id),
    applicationId: escrow.application_id ? String(escrow.application_id) : null,
    posterUserId: String(escrow.poster_user_id),
    helperUserId: escrow.helper_user_id ? String(escrow.helper_user_id) : null,
    amountTsh: expected,
  });
  if (String(escrow.integrity_hash) !== expectedSeal) {
    return { ok: false, message: "Escrow integrity check failed. Lock blocked." };
  }

  const payPatch: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
  };
  if (security?.providerTxnId) payPatch.provider_txn_id = security.providerTxnId;
  if (security?.webhookEventId) payPatch.webhook_event_id = security.webhookEventId;

  // Claim from pending, or from failed when Snippe already confirmed (missed webhook recover).
  const claimStatuses = security?.paidAmount != null ? ["pending", "failed"] : ["pending"];
  const { data: claimed, error: payErr } = await db
    .from("title_change_payments")
    .update(payPatch)
    .eq("id", payment.id)
    .in("status", claimStatuses)
    .select("id")
    .maybeSingle();
  if (payErr) return { ok: false, message: payErr.message };
  if (!claimed) {
    // Already paid — ensure escrow locked / funded
    if (
      String(escrow.status) === "funded" ||
      String(escrow.status) === "locked" ||
      String(escrow.status) === "delivered" ||
      String(escrow.status) === "released"
    ) {
      return { ok: true, message: "Already paid.", fulfilled: false };
    }
  }

  if (String(escrow.status) !== "awaiting_funds" && String(escrow.status) !== "locked") {
    return { ok: true, message: "Escrow already past funding.", fulfilled: false };
  }

  // Locked before picking: hold the money, mark the request taken, then poster picks a helper.
  if (!escrow.application_id) {
    const at = new Date().toISOString();
    const { error: fundErr } = await db
      .from("portal_job_escrows")
      .update({
        status: "funded",
        locked_at: at,
        payment_id: payment.id,
        payment_reference: payment.reference,
        updated_at: at,
      })
      .eq("id", escrow.id)
      .eq("status", "awaiting_funds");
    if (fundErr) return { ok: false, message: fundErr.message };

    // Same as "Mark as taken": leave the open board, keep pending offers for picking.
    await db
      .from("portal_jobs")
      .update({ status: "assigned", assigned_application_id: null, updated_at: at })
      .eq("id", escrow.job_id)
      .eq("status", "open");

    await logEscrowEvent(db, {
      escrowId: String(escrow.id),
      eventType: "funds_held",
      actorRole: "system",
      message: "Money locked in Honic escrow. Request marked taken. Poster can now pick a helper.",
    });
    return { ok: true, fulfilled: true };
  }

  const now = new Date().toISOString();
  const appId = String(escrow.application_id);
  const jobId = String(escrow.job_id);

  await db
    .from("portal_job_applications")
    .update({ status: "rejected", updated_at: now })
    .eq("job_id", jobId)
    .eq("status", "pending")
    .neq("id", appId);

  const { error: accErr } = await db
    .from("portal_job_applications")
    .update({ status: "accepted", updated_at: now })
    .eq("id", appId);
  if (accErr) return { ok: false, message: accErr.message };

  const { error: jobErr } = await db
    .from("portal_jobs")
    .update({ status: "assigned", assigned_application_id: appId, updated_at: now })
    .eq("id", jobId);
  if (jobErr) return { ok: false, message: jobErr.message };

  const deliveryDeadline = new Date(Date.now() + ESCROW_DELIVERY_HOURS * 3600 * 1000).toISOString();
  const { error: escErr } = await db
    .from("portal_job_escrows")
    .update({
      status: "locked",
      locked_at: now,
      delivery_deadline_at: deliveryDeadline,
      payment_id: payment.id,
      payment_reference: payment.reference,
      updated_at: now,
    })
    .eq("id", escrow.id)
    .in("status", ["awaiting_funds", "locked"]);
  if (escErr) return { ok: false, message: escErr.message };

  await logEscrowEvent(db, {
    escrowId: String(escrow.id),
    eventType: "funds_locked",
    actorRole: "system",
    message: `Escrow locked. Helper has ~${ESCROW_DELIVERY_HOURS}h to upload preview + final.`,
  });

  return { ok: true, fulfilled: true };
}

export function validateDeliverableUpload(input: {
  kind: DeliverableKind;
  mimeType: string;
  byteSize: number;
  originalName: string;
}): { ok: true } | { ok: false; message: string } {
  const name = input.originalName.trim().slice(0, 180);
  if (!name) return { ok: false, message: "File name required." };
  if (input.kind === "preview") {
    if (!(ESCROW_PREVIEW_MIME as readonly string[]).includes(input.mimeType)) {
      return { ok: false, message: "Preview must be a JPG, PNG, or WebP image (for watermarked review)." };
    }
    if (input.byteSize <= 0 || input.byteSize > ESCROW_PREVIEW_MAX_BYTES) {
      return { ok: false, message: "Preview image must be under 8 MB." };
    }
  } else {
    if (!(ESCROW_FINAL_MIME as readonly string[]).includes(input.mimeType)) {
      return { ok: false, message: "Final file type not allowed." };
    }
    if (input.byteSize <= 0 || input.byteSize > ESCROW_FINAL_MAX_BYTES) {
      return { ok: false, message: "Final file must be under 25 MB." };
    }
  }
  return { ok: true };
}

export async function registerDeliverable(
  db: SupabaseClient,
  input: {
    userId: string;
    escrowPublicId: string;
    kind: DeliverableKind;
    storagePath: string;
    mimeType: string;
    byteSize: number;
    originalName: string;
    contentSha256: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const check = validateDeliverableUpload(input);
  if (!check.ok) return check;
  if (!/^[a-f0-9]{64}$/i.test(input.contentSha256)) {
    return { ok: false, message: "Invalid file checksum." };
  }

  const { data: escrow, error } = await db
    .from("portal_job_escrows")
    .select("*")
    .eq("public_id", input.escrowPublicId)
    .maybeSingle();
  if (error || !escrow) return { ok: false, message: "Escrow not found." };
  if (String(escrow.helper_user_id) !== input.userId) {
    return { ok: false, message: "Only the selected helper can upload deliverables." };
  }
  if (!["locked", "delivered"].includes(String(escrow.status))) {
    return { ok: false, message: "Upload is only allowed after funds are locked." };
  }
  if (!String(input.storagePath).startsWith(`job-escrow/${escrow.id}/`)) {
    return { ok: false, message: "Invalid storage path." };
  }

  const { data: existingDel } = await db
    .from("portal_job_deliverables")
    .select("id, public_id")
    .eq("escrow_id", escrow.id)
    .eq("kind", input.kind)
    .maybeSingle();

  const delPublicId = existingDel?.public_id ? String(existingDel.public_id) : newPublicId();
  const row = {
    public_id: delPublicId,
    escrow_id: escrow.id,
    uploader_user_id: input.userId,
    kind: input.kind,
    storage_path: input.storagePath,
    mime_type: input.mimeType,
    byte_size: Math.round(input.byteSize),
    content_sha256: input.contentSha256.toLowerCase(),
    original_name: input.originalName.trim().slice(0, 180),
  };
  const { error: upErr } = existingDel?.id
    ? await db.from("portal_job_deliverables").update(row).eq("id", existingDel.id)
    : await db.from("portal_job_deliverables").insert(row);
  if (upErr) {
    if (missingEscrow(upErr.message)) {
      return { ok: false, message: "Escrow storage is not ready. Ask staff to apply migration 036." };
    }
    return { ok: false, message: upErr.message };
  }

  await logEscrowEvent(db, {
    escrowId: String(escrow.id),
    eventType: input.kind === "preview" ? "preview_uploaded" : "final_uploaded",
    actorRole: "helper",
    message:
      input.kind === "preview"
        ? `Helper uploaded preview “${input.originalName.trim().slice(0, 80)}”.`
        : `Helper uploaded final “${input.originalName.trim().slice(0, 80)}”.`,
  });

  // Mark delivered only when both preview + final exist.
  const { data: kinds } = await db
    .from("portal_job_deliverables")
    .select("kind")
    .eq("escrow_id", escrow.id);
  const have = new Set((kinds ?? []).map((k) => String(k.kind)));
  if (have.has("preview") && have.has("final") && String(escrow.status) === "locked") {
    const deadline = new Date(Date.now() + ESCROW_REVIEW_HOURS * 3600 * 1000).toISOString();
    const now = new Date().toISOString();
    await db
      .from("portal_job_escrows")
      .update({
        status: "delivered",
        delivered_at: now,
        review_deadline_at: deadline,
        revision_note: null,
        updated_at: now,
      })
      .eq("id", escrow.id)
      .eq("status", "locked");
    await logEscrowEvent(db, {
      escrowId: String(escrow.id),
      eventType: "delivered",
      actorRole: "helper",
      message: `Both files in. Poster check open for ~${ESCROW_REVIEW_HOURS}h (then auto-release).`,
    });
  }

  return { ok: true };
}

export async function confirmEscrowDelivery(
  db: SupabaseClient,
  input: { userId: string; escrowPublicId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  await maybeAutoReleaseEscrow(db, input.escrowPublicId);
  const { data: escrow } = await db
    .from("portal_job_escrows")
    .select("*")
    .eq("public_id", input.escrowPublicId)
    .maybeSingle();
  if (!escrow) return { ok: false, message: "Escrow not found." };
  if (String(escrow.poster_user_id) !== input.userId) {
    return { ok: false, message: "Only the poster can confirm delivery." };
  }
  if (String(escrow.status) === "released") return { ok: true };
  if (String(escrow.status) !== "delivered") {
    return { ok: false, message: "Confirm is only available during the review window." };
  }
  return releaseEscrow(db, escrow as Record<string, unknown>, "poster");
}

/** Poster asks helper to fix work without opening a dispute (free revision). */
export async function requestEscrowRevision(
  db: SupabaseClient,
  input: { userId: string; escrowPublicId: string; note: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const note = input.note.trim().slice(0, 1000);
  if (note.length < 12) return { ok: false, message: "Say what needs fixing (at least 12 characters)." };

  const { data: escrow } = await db
    .from("portal_job_escrows")
    .select("*")
    .eq("public_id", input.escrowPublicId)
    .maybeSingle();
  if (!escrow) return { ok: false, message: "Escrow not found." };
  if (String(escrow.poster_user_id) !== input.userId) {
    return { ok: false, message: "Only the poster can request a fix." };
  }
  if (String(escrow.status) !== "delivered") {
    return { ok: false, message: "Revision is only available during poster check." };
  }
  const count = Math.max(0, Number(escrow.revision_count) || 0);
  if (count >= ESCROW_MAX_REVISIONS) {
    return {
      ok: false,
      message: `Already used ${ESCROW_MAX_REVISIONS} free revisions. Open a dispute if it still is not right.`,
    };
  }

  const now = new Date().toISOString();
  const deliveryDeadline = new Date(Date.now() + ESCROW_REVISION_EXTRA_HOURS * 3600 * 1000).toISOString();
  const { error } = await db
    .from("portal_job_escrows")
    .update({
      status: "locked",
      delivered_at: null,
      review_deadline_at: null,
      revision_note: note,
      revision_requested_at: now,
      revision_count: count + 1,
      delivery_deadline_at: deliveryDeadline,
      updated_at: now,
    })
    .eq("id", escrow.id)
    .eq("status", "delivered");
  if (error) return { ok: false, message: error.message };

  await logEscrowEvent(db, {
    escrowId: String(escrow.id),
    eventType: "revision_requested",
    actorRole: "poster",
    message: `Poster requested a fix: ${note.slice(0, 200)}`,
    meta: { revisionCount: count + 1 },
  });
  return { ok: true };
}

export async function openEscrowDispute(
  db: SupabaseClient,
  input: { userId: string; escrowPublicId: string; reason: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const reason = input.reason.trim().slice(0, 1000);
  if (reason.length < 20) return { ok: false, message: "Explain the problem in at least 20 characters." };

  const { data: escrow } = await db
    .from("portal_job_escrows")
    .select("*")
    .eq("public_id", input.escrowPublicId)
    .maybeSingle();
  if (!escrow) return { ok: false, message: "Escrow not found." };
  const isPoster = String(escrow.poster_user_id) === input.userId;
  const isHelper = String(escrow.helper_user_id) === input.userId;
  if (!isPoster && !isHelper) return { ok: false, message: "Not allowed." };
  if (String(escrow.status) !== "delivered") {
    return { ok: false, message: "Disputes open only after delivery, before release." };
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from("portal_job_escrows")
    .update({
      status: "disputed",
      dispute_reason: reason,
      dispute_opened_by: input.userId,
      dispute_opened_at: now,
      updated_at: now,
    })
    .eq("id", escrow.id)
    .eq("status", "delivered");
  if (error) return { ok: false, message: error.message };
  await logEscrowEvent(db, {
    escrowId: String(escrow.id),
    eventType: "dispute_opened",
    actorRole: isPoster ? "poster" : "helper",
    message: `Dispute opened: ${reason.slice(0, 200)}`,
  });
  return { ok: true };
}

export async function resolveEscrowDispute(
  db: SupabaseClient,
  input: {
    staffUserId: string;
    escrowPublicId: string;
    resolution: "release" | "refund";
    note: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const note = input.note.trim().slice(0, 1000);
  if (note.length < 5) return { ok: false, message: "Add a short resolution note." };

  const { data: escrow } = await db
    .from("portal_job_escrows")
    .select("*")
    .eq("public_id", input.escrowPublicId)
    .maybeSingle();
  if (!escrow) return { ok: false, message: "Escrow not found." };
  if (String(escrow.status) !== "disputed") return { ok: false, message: "This escrow is not disputed." };

  const now = new Date().toISOString();
  await db
    .from("portal_job_escrows")
    .update({
      dispute_resolution: note,
      dispute_resolved_by: input.staffUserId,
      dispute_resolved_at: now,
      updated_at: now,
    })
    .eq("id", escrow.id);

  await logEscrowEvent(db, {
    escrowId: String(escrow.id),
    eventType: input.resolution === "release" ? "staff_release" : "staff_refund",
    actorRole: "staff",
    message: `Staff ${input.resolution}: ${note.slice(0, 200)}`,
  });

  if (input.resolution === "release") {
    return releaseEscrow(db, escrow as Record<string, unknown>, "staff");
  }
  return refundEscrow(db, escrow as Record<string, unknown>, "staff");
}

async function releaseEscrow(
  db: SupabaseClient,
  escrow: Record<string, unknown>,
  actor: EscrowActorRole = "system",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date().toISOString();
  const { error } = await db
    .from("portal_job_escrows")
    .update({ status: "released", released_at: now, updated_at: now })
    .eq("id", escrow.id)
    .in("status", ["delivered", "disputed", "locked"]);
  if (error) return { ok: false, message: error.message };

  await db
    .from("portal_jobs")
    .update({ status: "closed", updated_at: now })
    .eq("id", escrow.job_id);

  const payout = await loadPeerPayoutAccount(db, String(escrow.helper_user_id));
  const amount = Math.round(Number(escrow.amount_tsh));
  const integrity = sealPayoutRow({
    escrowId: String(escrow.id),
    helperUserId: String(escrow.helper_user_id),
    amountTsh: amount,
    phone: payout?.phone ?? "",
    network: payout?.network ?? "",
  });

  await db.from("portal_job_payouts").upsert(
    {
      public_id: newPublicId(),
      escrow_id: escrow.id,
      helper_user_id: escrow.helper_user_id,
      amount_tsh: amount,
      network: payout?.network ?? null,
      phone: payout?.phone ?? null,
      account_name: payout?.accountName ?? null,
      status: "queued",
      integrity_hash: integrity,
      updated_at: now,
    },
    { onConflict: "escrow_id" },
  );

  await logEscrowEvent(db, {
    escrowId: String(escrow.id),
    eventType: actor === "system" ? "auto_released" : "released",
    actorRole: actor,
    message:
      actor === "system"
        ? "Auto-released after review window. Helper payout queued."
        : "Escrow released. Final unlocked and helper payout queued.",
  });

  return { ok: true };
}

async function refundEscrow(
  db: SupabaseClient,
  escrow: Record<string, unknown>,
  actor: EscrowActorRole = "system",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date().toISOString();
  const { error } = await db
    .from("portal_job_escrows")
    .update({ status: "refunded", refunded_at: now, updated_at: now })
    .eq("id", escrow.id)
    .in("status", ["delivered", "disputed", "locked", "funded", "awaiting_funds"]);
  if (error) return { ok: false, message: error.message };

  await db
    .from("portal_jobs")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", escrow.job_id);

  await logEscrowEvent(db, {
    escrowId: String(escrow.id),
    eventType: actor === "system" ? "auto_refunded" : "refunded",
    actorRole: actor,
    message:
      actor === "system"
        ? "Auto-refunded — helper did not deliver before the deadline."
        : "Escrow refunded to poster.",
  });

  return { ok: true };
}

/** Auto-release when review deadline passed and still delivered. */
export async function maybeAutoReleaseEscrow(
  db: SupabaseClient,
  escrowPublicId: string,
): Promise<void> {
  const { data: escrow } = await db
    .from("portal_job_escrows")
    .select("*")
    .eq("public_id", escrowPublicId)
    .maybeSingle();
  if (!escrow) return;
  if (String(escrow.status) !== "delivered") return;
  const deadline = escrow.review_deadline_at ? new Date(String(escrow.review_deadline_at)).getTime() : 0;
  if (!deadline || Date.now() < deadline) return;
  await releaseEscrow(db, escrow as Record<string, unknown>, "system");
}

/** Auto-refund when helper never finishes delivery before the deadline. */
export async function maybeAutoRefundEscrow(
  db: SupabaseClient,
  escrowPublicId: string,
): Promise<void> {
  const { data: escrow } = await db
    .from("portal_job_escrows")
    .select("*")
    .eq("public_id", escrowPublicId)
    .maybeSingle();
  if (!escrow) return;
  if (String(escrow.status) !== "locked") return;
  const deadline = escrow.delivery_deadline_at ? new Date(String(escrow.delivery_deadline_at)).getTime() : 0;
  if (!deadline || Date.now() < deadline) return;
  await refundEscrow(db, escrow as Record<string, unknown>, "system");
}

export async function maybeAutoReleaseEscrowsForJob(db: SupabaseClient, jobId: string): Promise<void> {
  const { data } = await db
    .from("portal_job_escrows")
    .select("public_id, status")
    .eq("job_id", jobId)
    .maybeSingle();
  if (!data?.public_id) return;
  if (String(data.status) === "delivered") await maybeAutoReleaseEscrow(db, String(data.public_id));
  if (String(data.status) === "locked") await maybeAutoRefundEscrow(db, String(data.public_id));
}

/** Cron sweep: auto-release overdue reviews + auto-refund overdue deliveries. */
export async function sweepPeerHelpEscrows(
  db: SupabaseClient,
): Promise<{ released: number; refunded: number }> {
  const nowIso = new Date().toISOString();
  let released = 0;
  let refunded = 0;

  const { data: dueRelease } = await db
    .from("portal_job_escrows")
    .select("public_id")
    .eq("status", "delivered")
    .lte("review_deadline_at", nowIso)
    .limit(100);
  for (const row of dueRelease ?? []) {
    await maybeAutoReleaseEscrow(db, String(row.public_id));
    released += 1;
  }

  const { data: dueRefund } = await db
    .from("portal_job_escrows")
    .select("public_id")
    .eq("status", "locked")
    .lte("delivery_deadline_at", nowIso)
    .limit(100);
  for (const row of dueRefund ?? []) {
    await maybeAutoRefundEscrow(db, String(row.public_id));
    refunded += 1;
  }

  return { released, refunded };
}

export async function listEscrowEvents(
  db: SupabaseClient,
  escrowId: string,
): Promise<PortalJobEscrowEvent[]> {
  const { data, error } = await db
    .from("portal_job_escrow_events")
    .select("public_id, event_type, actor_role, message, created_at")
    .eq("escrow_id", escrowId)
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) {
    if (missingEscrow(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    publicId: String(row.public_id),
    eventType: String(row.event_type),
    actorRole: String(row.actor_role) as EscrowActorRole,
    message: String(row.message),
    createdAt: String(row.created_at),
  }));
}

export type { StaffEscrowQueueItem, StaffPayoutQueueItem };

export async function listDisputedEscrowsForStaff(db: SupabaseClient): Promise<StaffEscrowQueueItem[]> {
  const { data, error } = await db
    .from("portal_job_escrows")
    .select("public_id, amount_tsh, status, dispute_reason, updated_at, job_id")
    .eq("status", "disputed")
    .order("updated_at", { ascending: true })
    .limit(100);
  if (error) {
    if (missingEscrow(error.message)) return [];
    throw new Error(error.message);
  }
  const jobIds = [...new Set((data ?? []).map((r) => String(r.job_id)))];
  const { data: jobs } = jobIds.length
    ? await db.from("portal_jobs").select("id, public_id, title").in("id", jobIds)
    : { data: [] as { id: string; public_id: string; title: string }[] };
  const byId = new Map((jobs ?? []).map((j) => [String(j.id), j]));
  return (data ?? []).map((row) => {
    const job = byId.get(String(row.job_id));
    const jobPublicId = job ? String(job.public_id) : "";
    return {
      escrowPublicId: String(row.public_id),
      jobPublicId,
      jobTitle: job ? String(job.title) : "Peer-help job",
      amountTsh: Number(row.amount_tsh) || 0,
      status: String(row.status) as EscrowStatus,
      disputeReason: row.dispute_reason ? String(row.dispute_reason) : null,
      updatedAt: String(row.updated_at),
      href: jobPublicId ? `/portal/jobs/${encodeURIComponent(jobPublicId)}` : "/portal/jobs",
    };
  });
}

export async function listQueuedPeerPayoutsForStaff(db: SupabaseClient): Promise<StaffPayoutQueueItem[]> {
  const { data, error } = await db
    .from("portal_job_payouts")
    .select("public_id, escrow_id, amount_tsh, status, network, phone, account_name, updated_at")
    .in("status", ["queued", "processing", "failed"])
    .order("updated_at", { ascending: true })
    .limit(100);
  if (error) {
    if (missingEscrow(error.message)) return [];
    throw new Error(error.message);
  }
  const escrowIds = [...new Set((data ?? []).map((r) => String(r.escrow_id)))];
  const { data: escrows } = escrowIds.length
    ? await db.from("portal_job_escrows").select("id, public_id, job_id").in("id", escrowIds)
    : { data: [] as { id: string; public_id: string; job_id: string }[] };
  const escById = new Map((escrows ?? []).map((e) => [String(e.id), e]));
  const jobIds = [...new Set((escrows ?? []).map((e) => String(e.job_id)))];
  const { data: jobs } = jobIds.length
    ? await db.from("portal_jobs").select("id, public_id").in("id", jobIds)
    : { data: [] as { id: string; public_id: string }[] };
  const jobById = new Map((jobs ?? []).map((j) => [String(j.id), j]));

  return (data ?? []).map((row) => {
    const esc = escById.get(String(row.escrow_id));
    const job = esc ? jobById.get(String(esc.job_id)) : null;
    const jobPublicId = job ? String(job.public_id) : "";
    return {
      payoutPublicId: String(row.public_id),
      escrowPublicId: esc ? String(esc.public_id) : "",
      jobPublicId,
      amountTsh: Number(row.amount_tsh) || 0,
      status: String(row.status) as JobPayoutStatus,
      network: row.network ? String(row.network) : null,
      phone: row.phone ? String(row.phone) : null,
      accountName: row.account_name ? String(row.account_name) : null,
      updatedAt: String(row.updated_at),
      href: jobPublicId ? `/portal/jobs/${encodeURIComponent(jobPublicId)}` : "/portal/jobs",
    };
  });
}

export async function markPeerPayoutStatus(
  db: SupabaseClient,
  input: { payoutPublicId: string; status: "processing" | "paid" | "failed"; note?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status, updated_at: now };
  if (input.status === "paid") {
    patch.paid_at = now;
    patch.failure_reason = null;
  }
  if (input.status === "failed" && input.note?.trim()) {
    patch.failure_reason = input.note.trim().slice(0, 500);
  }

  const { data, error } = await db
    .from("portal_job_payouts")
    .update(patch)
    .eq("public_id", input.payoutPublicId)
    .in("status", ["queued", "processing", "failed"])
    .select("escrow_id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Payout not found or already paid." };

  if (data.escrow_id) {
    await logEscrowEvent(db, {
      escrowId: String(data.escrow_id),
      eventType: `payout_${input.status}`,
      actorRole: "staff",
      message:
        input.status === "paid"
          ? "Staff marked helper payout as paid."
          : input.status === "failed"
            ? "Staff marked helper payout as failed."
            : "Staff marked helper payout as processing.",
    });
  }
  return { ok: true };
}

/* ---------- Preview session tokens ---------- */

export async function issuePreviewSession(
  db: SupabaseClient,
  input: { viewerUserId: string; deliverablePublicId: string },
): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; message: string }> {
  const { data: del } = await db
    .from("portal_job_deliverables")
    .select("id, kind, escrow_id")
    .eq("public_id", input.deliverablePublicId)
    .maybeSingle();
  if (!del || String(del.kind) !== "preview") {
    return { ok: false, message: "Preview not found." };
  }

  const { data: escrow } = await db.from("portal_job_escrows").select("*").eq("id", del.escrow_id).maybeSingle();
  if (!escrow) return { ok: false, message: "Escrow not found." };

  const isPoster = String(escrow.poster_user_id) === input.viewerUserId;
  const isHelper = String(escrow.helper_user_id) === input.viewerUserId;
  if (!isPoster && !isHelper) return { ok: false, message: "Not allowed." };
  if (!["delivered", "disputed", "released", "locked"].includes(String(escrow.status))) {
    return { ok: false, message: "Preview is not available yet." };
  }
  // Poster may preview only after delivery (or during dispute/release). Helper can always check own preview.
  if (isPoster && !isHelper && !["delivered", "disputed", "released"].includes(String(escrow.status))) {
    return { ok: false, message: "Preview unlocks after the helper delivers." };
  }

  const raw = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  const { error } = await db.from("portal_job_preview_sessions").insert({
    deliverable_id: del.id,
    viewer_user_id: input.viewerUserId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    max_views: 25,
    view_count: 0,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, token: raw, expiresAt };
}

export async function consumePreviewSession(
  db: SupabaseClient,
  input: { token: string; viewerUserId: string },
): Promise<
  | {
      ok: true;
      storagePath: string;
      mimeType: string;
      watermark: string;
      escrowPublicId: string;
    }
  | { ok: false; message: string }
> {
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  const { data: session } = await db
    .from("portal_job_preview_sessions")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!session) return { ok: false, message: "Invalid preview session." };
  if (String(session.viewer_user_id) !== input.viewerUserId) {
    return { ok: false, message: "Preview session mismatch." };
  }
  if (new Date(String(session.expires_at)).getTime() < Date.now()) {
    return { ok: false, message: "Preview session expired." };
  }
  if (Number(session.view_count) >= Number(session.max_views)) {
    return { ok: false, message: "Preview view limit reached." };
  }

  const { data: del } = await db
    .from("portal_job_deliverables")
    .select("storage_path, mime_type, escrow_id, kind")
    .eq("id", session.deliverable_id)
    .maybeSingle();
  if (!del || String(del.kind) !== "preview") return { ok: false, message: "Preview missing." };

  const { data: escrow } = await db
    .from("portal_job_escrows")
    .select("public_id, poster_user_id, helper_user_id, status")
    .eq("id", del.escrow_id)
    .maybeSingle();
  if (!escrow) return { ok: false, message: "Escrow missing." };

  await db
    .from("portal_job_preview_sessions")
    .update({
      view_count: Number(session.view_count) + 1,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("view_count", session.view_count);

  const mark = `NEXIS·${String(escrow.public_id).slice(0, 8)}·${input.viewerUserId.slice(0, 8)}`;
  return {
    ok: true,
    storagePath: String(del.storage_path),
    mimeType: String(del.mime_type),
    watermark: mark,
    escrowPublicId: String(escrow.public_id),
  };
}

export async function authorizeFinalDownload(
  db: SupabaseClient,
  input: { userId: string; deliverablePublicId: string },
): Promise<{ ok: true; storagePath: string; mimeType: string; fileName: string } | { ok: false; message: string }> {
  const { data: del } = await db
    .from("portal_job_deliverables")
    .select("*")
    .eq("public_id", input.deliverablePublicId)
    .maybeSingle();
  if (!del || String(del.kind) !== "final") return { ok: false, message: "File not found." };

  const { data: escrow } = await db.from("portal_job_escrows").select("*").eq("id", del.escrow_id).maybeSingle();
  if (!escrow) return { ok: false, message: "Escrow not found." };

  const isPoster = String(escrow.poster_user_id) === input.userId;
  const isHelper = String(escrow.helper_user_id) === input.userId;
  if (!isPoster && !isHelper) return { ok: false, message: "Not allowed." };

  // Helper can always download their own final. Poster only after release.
  if (isPoster && !isHelper && String(escrow.status) !== "released") {
    return { ok: false, message: "Final file unlocks only after escrow release." };
  }

  return {
    ok: true,
    storagePath: String(del.storage_path),
    mimeType: String(del.mime_type),
    fileName: String(del.original_name),
  };
}

/* ---------- Peer payout accounts ---------- */

export type PeerPayoutAccount = {
  id: string;
  userId: string;
  network: string;
  phone: string;
  accountName: string;
  registeredName: string;
  status: string;
  sealOk: boolean;
};

export async function loadPeerPayoutAccount(
  db: SupabaseClient,
  userId: string,
): Promise<PeerPayoutAccount | null> {
  const { data, error } = await db.from("portal_peer_payout_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    if (missingEscrow(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const accountName = String(row.account_name ?? "");
  const registeredName = String(row.registered_name ?? "");
  const phone = String(row.phone ?? "");
  const network = String(row.network ?? "");
  const expected = sealPayoutAccount({
    userId,
    accountName,
    phone,
    network,
    registeredName,
  });
  return {
    id: String(row.id),
    userId,
    network,
    phone,
    accountName,
    registeredName,
    status: String(row.status ?? "active"),
    sealOk: String(row.integrity_hash) === expected,
  };
}

export async function savePeerPayoutAccount(
  db: SupabaseClient,
  input: {
    userId: string;
    network: string;
    phone: string;
    accountName: string;
    registeredName: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const network = String(input.network ?? "").trim();
  if (!(PAYMENT_NETWORKS as readonly string[]).includes(network)) {
    return { ok: false, message: "Choose a valid mobile-money network." };
  }
  const phone = toSnippePhone(input.phone);
  if (!phone) return { ok: false, message: "Enter a valid Tanzanian mobile number." };
  const accountName = normalizePersonName(input.accountName) ? input.accountName.trim().slice(0, 120) : "";
  if (!accountName) return { ok: false, message: "Enter the account holder name." };
  if (!payoutNameMatchesRegistered(input.registeredName, accountName)) {
    return { ok: false, message: "Account name must match your registered student name." };
  }

  const existing = await loadPeerPayoutAccount(db, input.userId);
  if (existing && existing.status === "locked") {
    return { ok: false, message: "Your peer-help payout account is locked. Contact Help desk." };
  }
  if (existing && existing.status === "active" && (existing.phone !== phone || existing.network !== network)) {
    await db
      .from("portal_peer_payout_accounts")
      .update({ status: "locked", locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", input.userId);
    return {
      ok: false,
      message: "Changing a saved payout number is blocked for security. Contact Help desk.",
    };
  }

  const integrity = sealPayoutAccount({
    userId: input.userId,
    accountName,
    phone,
    network,
    registeredName: input.registeredName,
  });
  const { error } = await db.from("portal_peer_payout_accounts").upsert(
    {
      user_id: input.userId,
      network,
      phone,
      account_name: accountName,
      registered_name: input.registeredName.trim().slice(0, 120),
      status: "active",
      integrity_hash: integrity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    if (missingEscrow(error.message)) {
      return { ok: false, message: "Payout storage is not ready. Ask staff to apply migration 036." };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
