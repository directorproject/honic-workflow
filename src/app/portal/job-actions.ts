"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { isStaffUser } from "@/lib/auth-staff";
import { simulatedPaymentsAllowed } from "@/lib/payments/security";
import {
  defaultPendingExpiresAt,
  expireStalePendingPayments,
  isPendingExpired,
  resolvePendingExpiresAt,
} from "@/lib/payments/pending-expiry";
import {
  createMobilePayment,
  makeIdempotencyKey,
  publicWebhookUrl,
  SNIPPE_MIN_AMOUNT_TSH,
  snippeConfigured,
  toSnippePhone,
} from "@/lib/payments/snippe";
import { PAYMENT_NETWORKS, PAYMENT_PROVIDER } from "@/lib/portal/config";
import { getPortalUser } from "@/lib/portal/data";
import {
  confirmEscrowDelivery,
  createEscrowForJob,
  ESCROW_DELIVERY_HOURS,
  pickHelperForFundedEscrow,
  fulfillJobEscrowPayment,
  getEscrowForJob,
  issuePreviewSession,
  listDeliverablesForEscrow,
  listEscrowEvents,
  loadPeerPayoutAccount,
  markPeerPayoutStatus,
  openEscrowDispute,
  reconcileAwaitingJobEscrow,
  registerDeliverable,
  requestEscrowRevision,
  resolveEscrowDispute,
  savePeerPayoutAccount,
  validateDeliverableUpload,
  type DeliverableKind,
  type PortalJobDeliverableMeta,
  type PortalJobEscrow,
  type PortalJobEscrowEvent,
} from "@/lib/portal/job-escrow";
import { peerHelpAccepted, PEER_HELP_METADATA_KEY, PEER_HELP_RULES_VERSION, peerHelpRulesError } from "@/lib/portal/jobs-peer-help";
import { paymentUnavailableMessage, toUserError } from "@/lib/portal/user-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyHelperPicked, notifyPosterNewApplication } from "@/lib/portal/job-notifications";
import { loadPayoutAccount } from "@/lib/portal/payout-accounts";
import {
  applyToJob,
  getJobByPublicId,
  getMyApplicationForJob,
  listApplicationsForJob,
  listMessagesSinceForApplicationPublicId,
  markJobTaken,
  createJob,
  deleteJob,
  postJobMessage,
  postPosterNote,
  updateJob,
  type JobPriceMode,
  type JobStatus,
  type PortalJobApplication,
  type PortalJobMessage,
} from "@/lib/portal/jobs";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

import type { PortalResult } from "@/app/portal/auth-actions";

async function requireStudent() {
  const user = await getPortalUser();
  if (!user) throw new Error("Please sign in again.");
  if (isStaffUser(user)) throw new Error("This account cannot use the student portal.");
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("Service unavailable. Please try again later.");
  return { user, db };
}

async function requirePortalActor() {
  const user = await getPortalUser();
  if (!user) throw new Error("Please sign in again.");
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("Service unavailable. Please try again later.");
  return { user, db };
}

export async function portalPostJobAction(input: {
  category: string;
  title: string;
  description: string;
  offerTsh: number;
  priceMode: string;
}): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const priceMode: JobPriceMode = input.priceMode === "negotiable" ? "negotiable" : "fixed";
    const result = await createJob(db, {
      userId: user.id,
      category: String(input.category ?? ""),
      title: String(input.title ?? ""),
      description: String(input.description ?? ""),
      offerTsh: Number(input.offerTsh),
      priceMode,
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return { ok: true, message: `Help request posted anonymously as Task ${result.publicId.slice(0, 8)}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not post your request." };
  }
}

export async function portalUpdateJobAction(input: {
  jobPublicId: string;
  category: string;
  title: string;
  description: string;
  offerTsh: number;
  priceMode: string;
}): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const priceMode: JobPriceMode = input.priceMode === "negotiable" ? "negotiable" : "fixed";
    const jobPublicId = String(input.jobPublicId ?? "");
    const result = await updateJob(db, {
      userId: user.id,
      jobPublicId,
      category: String(input.category ?? ""),
      title: String(input.title ?? ""),
      description: String(input.description ?? ""),
      offerTsh: Number(input.offerTsh),
      priceMode,
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    revalidatePath(`/portal/jobs/${encodeURIComponent(jobPublicId)}`);
    return { ok: true, message: "Request updated." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update the request." };
  }
}

export async function portalDeleteJobAction(jobPublicId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const id = String(jobPublicId ?? "");
    const result = await deleteJob(db, { userId: user.id, jobPublicId: id });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    revalidatePath(`/portal/jobs/${encodeURIComponent(id)}`);
    return { ok: true, message: "Job deleted." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not delete the job." };
  }
}

export async function portalApplyJobAction(input: {
  jobPublicId: string;
  message: string;
  proposedTsh?: number | null;
}): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const jobPublicId = String(input.jobPublicId ?? "");
    const result = await applyToJob(db, {
      userId: user.id,
      jobPublicId,
      message: String(input.message ?? ""),
      proposedTsh: input.proposedTsh == null || Number.isNaN(Number(input.proposedTsh)) ? null : Number(input.proposedTsh),
    });
    if (!result.ok) return { ok: false, message: result.message };

    await notifyPosterNewApplication(db, {
      jobId: result.jobId,
      jobPublicId,
      jobTitle: result.jobTitle,
      posterUserId: result.posterUserId,
      applicationId: result.applicationId,
      applicantPublicId: result.applicantPublicId,
      offerSnippet: result.message,
    });

    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    revalidatePath(`/portal/jobs/${encodeURIComponent(jobPublicId)}`);
    return {
      ok: true,
      message: "Offer sent. The requester gets a portal alert and email. Chat opens if they reply.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not apply." };
  }
}

/**
 * Select a helper and open escrow. Pass network+phone to push mobile-money for the locked amount.
 * Helper is only assigned after payment confirms (webhook or simulated).
 */
function revalidateJob(jobPublicId: string) {
  revalidatePath("/portal/jobs");
  revalidatePath("/portal/jobs/mine");
  revalidatePath(`/portal/jobs/${encodeURIComponent(jobPublicId)}`);
}

/**
 * Poster locks the request's money in Honic escrow (before picking anyone).
 * Then one tap on "Pick this helper" in any chat assigns that helper.
 */
export async function portalLockJobMoneyAction(
  jobPublicId: string,
  network?: string,
  phone?: string,
): Promise<PortalResult & { awaitingPayment?: boolean; paymentReference?: string }> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };

    const net = String(network ?? "").trim();
    const telRaw = String(phone ?? "").trim().replace(/\s/g, "");
    if (!(PAYMENT_NETWORKS as readonly string[]).includes(net)) {
      return { ok: false, message: "Choose how you will pay (M-Pesa, Airtel Money, etc.)." };
    }
    if (!toSnippePhone(telRaw)) {
      return { ok: false, message: "Enter a valid Tanzanian mobile number, e.g. 0712 345 678." };
    }

    const live = PAYMENT_PROVIDER === "snippe" && snippeConfigured();
    if (!live && !simulatedPaymentsAllowed()) {
      return { ok: false, message: paymentUnavailableMessage() };
    }

    // Recover a completed Snippe payment before expiring/replacing a stuck prompt.
    const jobForReconcile = await getJobByPublicId(db, String(jobPublicId ?? ""), user.id);
    if (jobForReconcile?.isMine) {
      const recovered = await reconcileAwaitingJobEscrow(db, {
        jobId: jobForReconcile.id,
        viewerUserId: user.id,
      });
      if (recovered.fulfilled) {
        revalidateJob(jobForReconcile.publicId);
        return {
          ok: true,
          message: "Payment confirmed. Money is locked — pick a helper in Chats.",
        };
      }
    }

    // Expire stale prompts first so a dead ESC row does not block a new lock.
    await expireStalePendingPayments(db, { userId: user.id, referencePrefix: "ESC" });
    const { data: openPay } = await db
      .from("title_change_payments")
      .select("id, reference, created_at, expires_at, amount")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .ilike("reference", "ESC%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      openPay &&
      !isPendingExpired({
        status: "pending",
        expiresAt: openPay.expires_at ? String(openPay.expires_at) : null,
        createdAt: openPay.created_at ? String(openPay.created_at) : null,
      })
    ) {
      return {
        ok: true,
        awaitingPayment: true,
        paymentReference: String(openPay.reference),
        message: "A payment prompt is already open. Check your phone and enter your PIN (it can take up to 30 seconds to arrive).",
      };
    }

    const created = await createEscrowForJob(db, {
      posterUserId: user.id,
      jobPublicId: String(jobPublicId ?? ""),
    });
    if (!created.ok) return { ok: false, message: created.message };

    const amount = created.amountTsh;
    // Fail fast before Snippe: provider rejects below this and the wait feels like a hang.
    if (live && amount < SNIPPE_MIN_AMOUNT_TSH) {
      await db
        .from("portal_job_escrows")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", created.escrow.id)
        .eq("status", "awaiting_funds");
      return {
        ok: false,
        message: `Mobile money needs at least TSh ${SNIPPE_MIN_AMOUNT_TSH.toLocaleString("en-TZ")}. Edit your request price and try again.`,
      };
    }

    const reference = makeIdempotencyKey("ESC");
    const pendingExpires = live ? defaultPendingExpiresAt() : null;
    const { data: paymentRow, error: insertError } = await db
      .from("title_change_payments")
      .insert({
        user_id: user.id,
        amount,
        currency: "TZS",
        provider: live ? "snippe" : "simulated",
        network: net,
        phone: telRaw,
        status: live ? "pending" : "paid",
        reference,
        purpose: "job_escrow",
        selection_id: null,
        expires_at: pendingExpires,
        paid_at: live ? null : new Date().toISOString(),
      })
      .select("id, user_id, status, reference, amount")
      .single();
    if (insertError) return { ok: false, message: insertError.message };

    await db
      .from("portal_job_escrows")
      .update({ payment_id: paymentRow.id, payment_reference: reference, updated_at: new Date().toISOString() })
      .eq("id", created.escrow.id);

    if (live) {
      try {
        const { data: profile } = await db
          .from("student_profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        const parts = String(profile?.full_name ?? "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const firstname = parts[0] || "Student";
        const lastname = parts.length > 1 ? parts.slice(1).join(" ") : "Portal";
        const payment = await createMobilePayment({
          amountTsh: amount,
          phoneNumber: telRaw,
          customer: { firstname, lastname, email: user.email || "student@honiccompany.com" },
          orderId: reference,
          webhookUrl: publicWebhookUrl(),
          idempotencyKey: reference,
          metadata: {
            purpose: "job_escrow",
            escrow_id: created.escrow.publicId,
            job_id: created.jobPublicId,
          },
        });
        const expiresAt = resolvePendingExpiresAt(payment.expiresAt);
        await db
          .from("title_change_payments")
          .update({ provider_txn_id: payment.reference, network: net, expires_at: expiresAt })
          .eq("id", paymentRow.id);
      } catch (err) {
        await db.from("title_change_payments").update({ status: "failed" }).eq("id", paymentRow.id);
        await db
          .from("portal_job_escrows")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", created.escrow.id)
          .eq("status", "awaiting_funds");
        return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
      }
      revalidateJob(created.jobPublicId);
      return {
        ok: true,
        awaitingPayment: true,
        paymentReference: reference,
        message: `Check your phone: enter your PIN to lock TSh ${amount.toLocaleString("en-TZ")}. The prompt can take 10–30 seconds.`,
      };
    }

    const fulfilled = await fulfillJobEscrowPayment(db, {
      id: String(paymentRow.id),
      user_id: user.id,
      status: "pending",
      reference,
      amount,
    });
    if (!fulfilled.ok) return { ok: false, message: toUserError(fulfilled.message, paymentUnavailableMessage()) };

    revalidateJob(created.jobPublicId);
    return { ok: true, message: `TSh ${amount.toLocaleString("en-TZ")} locked. Now pick a helper in Chats.` };
  } catch (err) {
    return { ok: false, message: toUserError(err, "Could not lock your money. Please try again.") };
  }
}

/** One tap: pick this helper (money must already be locked). Notifies the helper. */
export async function portalPickHelperAction(applicationPublicId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };

    const picked = await pickHelperForFundedEscrow(db, {
      posterUserId: user.id,
      applicationPublicId: String(applicationPublicId ?? ""),
    });
    if (!picked.ok) return { ok: false, message: picked.message };

    revalidateJob(picked.jobPublicId);

    const amount = `TSh ${picked.amountTsh.toLocaleString("en-TZ")}`;
    after(async () => {
      try {
        const peerPayout = await loadPeerPayoutAccount(db, picked.helperUserId);
        const payoutReady = Boolean(peerPayout?.sealOk && peerPayout.status === "active");
        await Promise.all([
          postPosterNote(db, {
            posterUserId: user.id,
            applicationId: picked.applicationId,
            body: payoutReady
              ? `You're picked! ${amount} is locked in Honic escrow. Your payout number is saved, so you can start now. Upload a preview + final file on this page within ${ESCROW_DELIVERY_HOURS}h.`
              : `You're picked! ${amount} is locked in Honic escrow. Next: set the number you'll be paid on (or use your saved payout account) on this page, then start. Upload a preview + final file within ${ESCROW_DELIVERY_HOURS}h.`,
          }),
          notifyHelperPicked(db, {
            jobId: picked.jobId,
            jobPublicId: picked.jobPublicId,
            jobTitle: picked.jobTitle,
            helperUserId: picked.helperUserId,
            applicationId: picked.applicationId,
            amountTsh: picked.amountTsh,
            payoutReady,
          }),
        ]);
      } catch (err) {
        console.error("pick helper follow-up:", err);
      }
    });

    return { ok: true, message: "Helper picked. They can start now." };
  } catch (err) {
    return { ok: false, message: toUserError(err, "Could not pick this helper. Please try again.") };
  }
}

/** Helper: copy the number from their saved payout account into peer-help payouts. */
export async function portalUseSavedPayoutAction(): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const [{ data: profile }, saved] = await Promise.all([
      db.from("student_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
      loadPayoutAccount(db, user.id),
    ]);
    if (!profile?.full_name) return { ok: false, message: "Complete your profile name first." };
    if (!saved || !saved.sealOk || saved.status !== "active") {
      return { ok: false, message: "No saved payout account found. Enter your number below instead." };
    }
    const result = await savePeerPayoutAccount(db, {
      userId: user.id,
      network: saved.network,
      phone: saved.phone,
      accountName: saved.accountName,
      registeredName: String(profile.full_name),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return { ok: true, message: "Done. You'll be paid on your saved number." };
  } catch (err) {
    return { ok: false, message: toUserError(err, "Could not use your saved number. Please try again.") };
  }
}

export async function portalJobMessageAction(
  applicationPublicId: string,
  body: string,
): Promise<PortalResult & { chat?: PortalJobMessage }> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const result = await postJobMessage(db, {
      userId: user.id,
      applicationPublicId: String(applicationPublicId ?? ""),
      body: String(body ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.message };
    // No revalidatePath — chat UI appends locally (WhatsApp-style). Poll picks up the peer side.
    return { ok: true, message: "Message sent.", chat: result.chat };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not send message." };
  }
}

/** Live peer-help chat poll — returns only messages newer than `sinceIso`. */
export async function portalJobMessagesSinceAction(input: {
  applicationPublicId: string;
  sinceIso: string;
}): Promise<{ ok: boolean; applicationId?: string; messages: PortalJobMessage[] }> {
  try {
    const { user, db } = await requireStudent();
    const res = await listMessagesSinceForApplicationPublicId(
      db,
      String(input.applicationPublicId ?? ""),
      user.id,
      String(input.sinceIso ?? ""),
    );
    if (!res) return { ok: true, messages: [] };
    return { ok: true, applicationId: res.applicationId, messages: res.messages };
  } catch {
    return { ok: false, messages: [] };
  }
}

/** Live sync for a job page: offers, chat, escrow tools, shared activity. */
export async function portalJobDetailSyncAction(input: {
  jobPublicId: string;
  applicationPublicId?: string | null;
  messagesSinceIso?: string | null;
}): Promise<{
  ok: boolean;
  jobStatus?: JobStatus;
  applications: PortalJobApplication[];
  myApplication: PortalJobApplication | null;
  messages: PortalJobMessage[];
  applicationId?: string;
  escrow: PortalJobEscrow | null;
  deliverables: PortalJobDeliverableMeta[];
  events: PortalJobEscrowEvent[];
}> {
  try {
    const { user, db } = await requireStudent();
    const jobPublicId = String(input.jobPublicId ?? "");
    const job = await getJobByPublicId(db, jobPublicId, user.id);
    if (!job) {
      return {
        ok: false,
        applications: [],
        myApplication: null,
        messages: [],
        escrow: null,
        deliverables: [],
        events: [],
      };
    }

    const applications = job.isMine ? await listApplicationsForJob(db, job.id, user.id) : [];
    const myApplication = !job.isMine ? await getMyApplicationForJob(db, job.id, user.id) : null;

    let messages: PortalJobMessage[] = [];
    let applicationId: string | undefined;
    const appPublicId = input.applicationPublicId ? String(input.applicationPublicId) : "";
    if (appPublicId) {
      const since = String(input.messagesSinceIso ?? new Date(0).toISOString());
      const res = await listMessagesSinceForApplicationPublicId(db, appPublicId, user.id, since);
      if (res) {
        messages = res.messages;
        applicationId = res.applicationId;
      }
    }

    let escrow = await getEscrowForJob(db, job.id, user.id);
  let liveJob = job;
    if (job.isMine && escrow?.status === "awaiting_funds") {
      await reconcileAwaitingJobEscrow(db, { jobId: job.id, viewerUserId: user.id });
      liveJob = (await getJobByPublicId(db, jobPublicId, user.id)) ?? job;
      escrow = (await getEscrowForJob(db, job.id, user.id)) ?? escrow;
    }
    const deliverables = escrow ? await listDeliverablesForEscrow(db, escrow.id) : [];
    const events = escrow ? await listEscrowEvents(db, escrow.id) : [];

    return {
      ok: true,
      jobStatus: liveJob.status,
      applications,
      myApplication,
      messages,
      applicationId,
      escrow,
      deliverables,
      events,
    };
  } catch {
    return {
      ok: false,
      applications: [],
      myApplication: null,
      messages: [],
      escrow: null,
      deliverables: [],
      events: [],
    };
  }
}


/** Records the student's acceptance of the current peer-help rules. Required before any post, offer, or message. */
export async function portalAcceptPeerHelpRulesAction(): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const { data, error } = await db.auth.admin.getUserById(user.id);
    if (error) return { ok: false, message: error.message };
    if (!data.user) return { ok: false, message: "Please sign in again." };
    const merged = {
      ...((data.user.user_metadata ?? {}) as Record<string, unknown>),
      [PEER_HELP_METADATA_KEY]: PEER_HELP_RULES_VERSION,
      peer_help_rules_accepted_at: new Date().toISOString(),
    };
    const { error: updateError } = await db.auth.admin.updateUserById(user.id, { user_metadata: merged });
    if (updateError) return { ok: false, message: updateError.message };
    const supabase = await createSupabaseServerClient();
    await supabase.auth.updateUser({ data: merged });
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return { ok: true, message: "Thanks. You can now use peer help." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save your acceptance." };
  }
}

/** Poster marks their request as taken without choosing a helper. */
export async function portalMarkJobTakenAction(jobPublicId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const result = await markJobTaken(db, { userId: user.id, jobPublicId: String(jobPublicId ?? "") });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    revalidatePath(`/portal/jobs/${encodeURIComponent(String(jobPublicId))}`);
    return { ok: true, message: "Marked as taken. It is removed from the open list." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update the request." };
  }
}

export async function portalEscrowConfirmAction(escrowPublicId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const result = await confirmEscrowDelivery(db, {
      userId: user.id,
      escrowPublicId: String(escrowPublicId ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return { ok: true, message: "Confirmed. Final file unlocked. Helper payout is queued." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not confirm." };
  }
}

export async function portalEscrowDisputeAction(escrowPublicId: string, reason: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const result = await openEscrowDispute(db, {
      userId: user.id,
      escrowPublicId: String(escrowPublicId ?? ""),
      reason: String(reason ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return { ok: true, message: "Dispute opened. Honic will review chat + preview evidence." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not open dispute." };
  }
}

export async function portalEscrowRevisionAction(escrowPublicId: string, note: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const result = await requestEscrowRevision(db, {
      userId: user.id,
      escrowPublicId: String(escrowPublicId ?? ""),
      note: String(note ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return { ok: true, message: "Fix requested. Helper can re-upload preview + final." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not request a fix." };
  }
}

export async function portalMarkPeerPayoutAction(
  payoutPublicId: string,
  status: "processing" | "paid" | "failed",
  note?: string,
): Promise<PortalResult> {
  try {
    const { user, db } = await requirePortalActor();
    if (!isStaffUser(user)) return { ok: false, message: "Staff only." };
    const result = await markPeerPayoutStatus(db, {
      payoutPublicId: String(payoutPublicId ?? ""),
      status,
      note: note ? String(note) : undefined,
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/finance/peer-help");
    revalidatePath("/portal/jobs");
    return {
      ok: true,
      message:
        status === "paid" ? "Marked paid." : status === "failed" ? "Marked failed." : "Marked processing.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update payout." };
  }
}

export async function portalEscrowResolveAction(
  escrowPublicId: string,
  resolution: "release" | "refund",
  note: string,
): Promise<PortalResult> {
  try {
    const { user, db } = await requirePortalActor();
    if (!isStaffUser(user)) return { ok: false, message: "Staff only." };
    const result = await resolveEscrowDispute(db, {
      staffUserId: user.id,
      escrowPublicId: String(escrowPublicId ?? ""),
      resolution,
      note: String(note ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    return { ok: true, message: resolution === "release" ? "Released to helper." : "Refunded to poster." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not resolve." };
  }
}

export async function portalSavePeerPayoutAction(input: {
  network: string;
  phone: string;
  accountName: string;
}): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const { data: profile } = await db
      .from("student_profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.full_name) return { ok: false, message: "Complete your profile name first." };
    const result = await savePeerPayoutAccount(db, {
      userId: user.id,
      network: String(input.network ?? ""),
      phone: String(input.phone ?? ""),
      accountName: String(input.accountName ?? ""),
      registeredName: String(profile.full_name),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return { ok: true, message: "Peer-help payout number saved. Changes later require Help desk." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save payout." };
  }
}

/** Helper: get a signed upload URL for preview/final deliverable. */
export async function portalEscrowUploadUrlAction(input: {
  escrowPublicId: string;
  kind: DeliverableKind;
  fileName: string;
  mimeType: string;
  byteSize: number;
}): Promise<PortalResult & { uploadUrl?: string; storagePath?: string; token?: string }> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const kind = input.kind === "final" ? "final" : "preview";
    const check = validateDeliverableUpload({
      kind,
      mimeType: String(input.mimeType ?? ""),
      byteSize: Number(input.byteSize),
      originalName: String(input.fileName ?? ""),
    });
    if (!check.ok) return { ok: false, message: check.message };

    const { data: escrow } = await db
      .from("portal_job_escrows")
      .select("id, helper_user_id, status, public_id")
      .eq("public_id", String(input.escrowPublicId ?? ""))
      .maybeSingle();
    if (!escrow) return { ok: false, message: "Escrow not found." };
    if (String(escrow.helper_user_id) !== user.id) return { ok: false, message: "Only the helper can upload." };
    if (!["locked", "delivered"].includes(String(escrow.status))) {
      return { ok: false, message: "Upload after funds are locked." };
    }

    const safeName = String(input.fileName ?? "file")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 80);
    const storagePath = `job-escrow/${escrow.id}/${kind}-${Date.now()}-${safeName}`;
    const { data, error } = await db.storage.from(STORAGE_BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data?.signedUrl) return { ok: false, message: error?.message || "Upload URL failed." };
    return {
      ok: true,
      message: "Upload URL ready.",
      uploadUrl: data.signedUrl,
      storagePath,
      token: data.token,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not start upload." };
  }
}

export async function portalEscrowRegisterUploadAction(input: {
  escrowPublicId: string;
  kind: DeliverableKind;
  storagePath: string;
  mimeType: string;
  byteSize: number;
  originalName: string;
  contentSha256: string;
}): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const result = await registerDeliverable(db, {
      userId: user.id,
      escrowPublicId: String(input.escrowPublicId ?? ""),
      kind: input.kind === "final" ? "final" : "preview",
      storagePath: String(input.storagePath ?? ""),
      mimeType: String(input.mimeType ?? ""),
      byteSize: Number(input.byteSize),
      originalName: String(input.originalName ?? ""),
      contentSha256: String(input.contentSha256 ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return {
      ok: true,
      message:
        input.kind === "preview"
          ? "Watermarked preview stored. Upload the final file too to open the review window."
          : "Final file stored. When both files are in, the poster gets a secure preview window.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not register upload." };
  }
}

export async function portalEscrowPreviewTokenAction(deliverablePublicId: string): Promise<
  PortalResult & { token?: string; expiresAt?: string }
> {
  try {
    const { user, db } = await requireStudent();
    const result = await issuePreviewSession(db, {
      viewerUserId: user.id,
      deliverablePublicId: String(deliverablePublicId ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, message: "Preview session ready.", token: result.token, expiresAt: result.expiresAt };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not open preview." };
  }
}

