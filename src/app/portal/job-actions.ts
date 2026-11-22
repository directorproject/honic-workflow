"use server";

import { revalidatePath } from "next/cache";

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
  snippeConfigured,
  toSnippePhone,
} from "@/lib/payments/snippe";
import { PAYMENT_NETWORKS, PAYMENT_PROVIDER } from "@/lib/portal/config";
import { getPortalUser } from "@/lib/portal/data";
import {
  confirmEscrowDelivery,
  createEscrowForApplication,
  fulfillJobEscrowPayment,
  issuePreviewSession,
  openEscrowDispute,
  registerDeliverable,
  resolveEscrowDispute,
  savePeerPayoutAccount,
  validateDeliverableUpload,
  type DeliverableKind,
} from "@/lib/portal/job-escrow";
import { peerHelpAccepted, PEER_HELP_METADATA_KEY, PEER_HELP_RULES_VERSION, peerHelpRulesError } from "@/lib/portal/jobs-peer-help";
import { paymentUnavailableMessage, toUserError } from "@/lib/portal/user-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyPosterNewApplication } from "@/lib/portal/job-notifications";
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
  updateJob,
  type JobPriceMode,
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
export async function portalAcceptJobApplicationAction(
  applicationPublicId: string,
  network?: string,
  phone?: string,
): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };

    const net = String(network ?? "").trim();
    const telRaw = String(phone ?? "").trim().replace(/\s/g, "");
    if (!(PAYMENT_NETWORKS as readonly string[]).includes(net)) {
      return { ok: false, message: "Choose your mobile-money network to lock escrow." };
    }
    if (!toSnippePhone(telRaw)) {
      return { ok: false, message: "Enter a valid Tanzanian mobile number to fund escrow." };
    }

    const created = await createEscrowForApplication(db, {
      posterUserId: user.id,
      applicationPublicId: String(applicationPublicId ?? ""),
    });
    if (!created.ok) return { ok: false, message: created.message };

    const live = PAYMENT_PROVIDER === "snippe" && snippeConfigured();
    if (!live && !simulatedPaymentsAllowed()) {
      return { ok: false, message: paymentUnavailableMessage() };
    }

    await expireStalePendingPayments(db, { userId: user.id, referencePrefix: "ESC" });
    const { data: openPay } = await db
      .from("title_change_payments")
      .select("id, reference, created_at, expires_at")
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
        message: `Escrow payment already open (ref ${openPay.reference}). Approve on your phone to lock funds.`,
      };
    }

    const reference = makeIdempotencyKey("ESC");
    const amount = created.amountTsh;
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
      .update({
        payment_id: paymentRow.id,
        payment_reference: reference,
        updated_at: new Date().toISOString(),
      })
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
        return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
      }
      revalidatePath("/portal/jobs");
      revalidatePath("/portal/jobs/mine");
      revalidatePath(`/portal/jobs/${encodeURIComponent(created.jobPublicId)}`);
      return {
        ok: true,
        message: `Check your phone to lock TSh ${amount.toLocaleString()} in escrow (ref ${reference}). Helper is assigned only after payment confirms.`,
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

    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    revalidatePath(`/portal/jobs/${encodeURIComponent(created.jobPublicId)}`);
    return {
      ok: true,
      message: `Escrow locked (TSh ${amount.toLocaleString()}). Helper selected — they can deliver a watermarked preview + final file.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not accept." };
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
    // Soft revalidate for other tabs; live UI appends `chat` without a full refresh.
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
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

/** Live sync for a job page: offers + optional open thread messages. */
export async function portalJobDetailSyncAction(input: {
  jobPublicId: string;
  applicationPublicId?: string | null;
  messagesSinceIso?: string | null;
}): Promise<{
  ok: boolean;
  applications: PortalJobApplication[];
  myApplication: PortalJobApplication | null;
  messages: PortalJobMessage[];
  applicationId?: string;
}> {
  try {
    const { user, db } = await requireStudent();
    const jobPublicId = String(input.jobPublicId ?? "");
    const job = await getJobByPublicId(db, jobPublicId, user.id);
    if (!job) {
      return { ok: false, applications: [], myApplication: null, messages: [] };
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

    return { ok: true, applications, myApplication, messages, applicationId };
  } catch {
    return { ok: false, applications: [], myApplication: null, messages: [] };
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

