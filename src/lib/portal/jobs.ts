import type { SupabaseClient } from "@supabase/supabase-js";

import { ensurePortalAccount, newPublicId } from "@/lib/portal/accounts";
import {
  JOB_CATEGORIES,
  anonymousLabel,
  jobCategoryLabel,
  type ApplicationStatus,
  type JobPriceMode,
  type JobStatus,
  type PortalJob,
  type PortalJobApplication,
  type PortalJobMessage,
} from "@/lib/portal/jobs-shared";
import { requireActiveDeskPlan, type PaidDeskFeature } from "@/lib/portal/plan-access";

async function requirePaidDeskForJobs(
  db: SupabaseClient,
  userId: string,
  feature: PaidDeskFeature = "jobsPost",
): Promise<{ ok: true } | { ok: false; message: string }> {
  return requireActiveDeskPlan(db, userId, feature);
}

export type {
  ApplicationStatus,
  JobCategoryId,
  JobPriceMode,
  JobStatus,
  PortalJob,
  PortalJobApplication,
  PortalJobMessage,
} from "@/lib/portal/jobs-shared";
export {
  JOB_CATEGORIES,
  anonymousLabel,
  jobCategoryLabel,
  jobRefLabel,
} from "@/lib/portal/jobs-shared";

function missingJobs(message: string): boolean {
  return /portal_jobs|portal_job_applications|portal_job_messages|does not exist|schema cache/i.test(message);
}

function asJob(row: Record<string, unknown>, viewerId: string | null): PortalJob {
  const posterPublicId = String(row.poster_public_id ?? "");
  return {
    id: String(row.id),
    publicId: String(row.public_id ?? ""),
    posterPublicId,
    posterLabel: anonymousLabel(posterPublicId, "Poster"),
    category: String(row.category ?? ""),
    categoryLabel: jobCategoryLabel(String(row.category ?? "")),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    offerTsh: Number(row.offer_tsh) || 0,
    priceMode: row.price_mode === "negotiable" ? "negotiable" : "fixed",
    status: String(row.status ?? "open") as JobStatus,
    createdAt: String(row.created_at),
    isMine: Boolean(viewerId && String(row.poster_user_id) === viewerId),
  };
}

function asApplication(row: Record<string, unknown>, viewerId: string | null): PortalJobApplication {
  const applicantPublicId = String(row.applicant_public_id ?? "");
  const nestedRaw = row.portal_jobs as { public_id?: string } | { public_id?: string }[] | null | undefined;
  const nestedJob = Array.isArray(nestedRaw) ? nestedRaw[0] : nestedRaw;
  const jobPublicId =
    (typeof row.job_public_id === "string" && row.job_public_id) ||
    (nestedJob?.public_id ? String(nestedJob.public_id) : null);
  return {
    id: String(row.id),
    publicId: String(row.public_id ?? ""),
    jobId: String(row.job_id ?? ""),
    jobPublicId,
    applicantPublicId,
    applicantLabel: anonymousLabel(applicantPublicId, "Helper"),
    message: String(row.message ?? ""),
    proposedTsh: row.proposed_tsh != null ? Number(row.proposed_tsh) : null,
    status: String(row.status ?? "pending") as ApplicationStatus,
    createdAt: String(row.created_at),
    isMine: Boolean(viewerId && String(row.applicant_user_id) === viewerId),
  };
}

export async function listOpenJobs(db: SupabaseClient, viewerId: string | null): Promise<PortalJob[]> {
  let q = db
    .from("portal_jobs")
    .select(
      "id, public_id, poster_user_id, poster_public_id, category, title, description, offer_tsh, price_mode, status, created_at",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(80);
  // Poster manages their own requests under My peer help — hide them from the public board.
  if (viewerId) q = q.neq("poster_user_id", viewerId);
  const { data, error } = await q;
  if (error) {
    if (missingJobs(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => asJob(row as Record<string, unknown>, viewerId));
}

export async function listMyJobs(db: SupabaseClient, userId: string): Promise<PortalJob[]> {
  const { data, error } = await db
    .from("portal_jobs")
    .select(
      "id, public_id, poster_user_id, poster_public_id, category, title, description, offer_tsh, price_mode, status, created_at",
    )
    .eq("poster_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    if (missingJobs(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => asJob(row as Record<string, unknown>, userId));
}

export async function getJobByPublicId(
  db: SupabaseClient,
  publicId: string,
  viewerId: string | null,
): Promise<PortalJob | null> {
  const { data, error } = await db
    .from("portal_jobs")
    .select(
      "id, public_id, poster_user_id, poster_public_id, category, title, description, offer_tsh, price_mode, status, created_at",
    )
    .eq("public_id", publicId)
    .maybeSingle();
  if (error) {
    if (missingJobs(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return asJob(data as Record<string, unknown>, viewerId);
}

export async function listApplicationsForJob(
  db: SupabaseClient,
  jobId: string,
  viewerId: string | null,
): Promise<PortalJobApplication[]> {
  const { data, error } = await db
    .from("portal_job_applications")
    .select(
      "id, public_id, job_id, applicant_user_id, applicant_public_id, message, proposed_tsh, status, created_at",
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingJobs(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => asApplication(row as Record<string, unknown>, viewerId));
}

export async function getMyApplicationForJob(
  db: SupabaseClient,
  jobId: string,
  userId: string,
): Promise<PortalJobApplication | null> {
  const { data, error } = await db
    .from("portal_job_applications")
    .select(
      "id, public_id, job_id, applicant_user_id, applicant_public_id, message, proposed_tsh, status, created_at",
    )
    .eq("job_id", jobId)
    .eq("applicant_user_id", userId)
    .maybeSingle();
  if (error) {
    if (missingJobs(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return asApplication(data as Record<string, unknown>, userId);
}

export async function listMyApplications(db: SupabaseClient, userId: string): Promise<PortalJobApplication[]> {
  const { data, error } = await db
    .from("portal_job_applications")
    .select(
      "id, public_id, job_id, applicant_user_id, applicant_public_id, message, proposed_tsh, status, created_at, portal_jobs ( public_id )",
    )
    .eq("applicant_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    if (missingJobs(error.message)) return [];
    // Fallback without join if relation not cached yet.
    if (/portal_jobs|relationship|schema cache/i.test(error.message)) {
      const retry = await db
        .from("portal_job_applications")
        .select(
          "id, public_id, job_id, applicant_user_id, applicant_public_id, message, proposed_tsh, status, created_at",
        )
        .eq("applicant_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (retry.error) throw new Error(retry.error.message);
      return (retry.data ?? []).map((row) => asApplication(row as Record<string, unknown>, userId));
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => asApplication(row as Record<string, unknown>, userId));
}

export async function listMessagesForApplication(
  db: SupabaseClient,
  applicationId: string,
  viewerId: string | null,
): Promise<PortalJobMessage[]> {
  const { data, error } = await db
    .from("portal_job_messages")
    .select("id, sender_user_id, sender_public_id, body, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    if (missingJobs(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => {
    const senderPublicId = String(row.sender_public_id ?? "");
    return {
      id: String(row.id),
      senderPublicId,
      senderLabel: anonymousLabel(senderPublicId, "Helper").replace("Helper", "ID"),
      body: String(row.body ?? ""),
      createdAt: String(row.created_at),
      isMine: Boolean(viewerId && String(row.sender_user_id) === viewerId),
    };
  });
}

export async function createJob(
  db: SupabaseClient,
  input: {
    userId: string;
    category: string;
    title: string;
    description: string;
    offerTsh: number;
    priceMode: JobPriceMode;
  },
): Promise<{ ok: true; publicId: string } | { ok: false; message: string }> {
  const plan = await requirePaidDeskForJobs(db, input.userId, "jobsPost");
  if (!plan.ok) return plan;

  if (!JOB_CATEGORIES.some((c) => c.id === input.category)) {
    return { ok: false, message: "Choose a valid job category." };
  }
  const title = input.title.trim().slice(0, 160);
  const description = input.description.trim().slice(0, 4000);
  if (title.length < 8) return { ok: false, message: "Write a clearer job title (at least 8 characters)." };
  if (description.length < 20) return { ok: false, message: "Add more detail about the work (at least 20 characters)." };
  if (!Number.isFinite(input.offerTsh) || input.offerTsh < 500) {
    return { ok: false, message: "Offer at least TSh 500." };
  }

  const posterPublicId = await ensurePortalAccount(db, input.userId);
  const publicId = newPublicId();
  const { error } = await db.from("portal_jobs").insert({
    public_id: publicId,
    poster_user_id: input.userId,
    poster_public_id: posterPublicId,
    category: input.category,
    title,
    description,
    offer_tsh: Math.round(input.offerTsh),
    price_mode: input.priceMode,
    status: "open",
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (missingJobs(error.message)) {
      return { ok: false, message: "Jobs storage is not ready. Ask staff to apply migration 023." };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true, publicId };
}

export async function updateJob(
  db: SupabaseClient,
  input: {
    userId: string;
    jobPublicId: string;
    category: string;
    title: string;
    description: string;
    offerTsh: number;
    priceMode: JobPriceMode;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await requirePaidDeskForJobs(db, input.userId, "jobsManage");
  if (!plan.ok) return plan;

  const job = await getJobByPublicId(db, input.jobPublicId, input.userId);
  if (!job) return { ok: false, message: "That job was not found." };
  if (!job.isMine) return { ok: false, message: "Only the poster can edit this job." };
  if (job.status === "closed" || job.status === "cancelled") {
    return { ok: false, message: "This job is closed and cannot be edited." };
  }

  if (!JOB_CATEGORIES.some((c) => c.id === input.category)) {
    return { ok: false, message: "Choose a valid job category." };
  }
  const title = input.title.trim().slice(0, 160);
  const description = input.description.trim().slice(0, 4000);
  if (title.length < 8) return { ok: false, message: "Write a clearer job title (at least 8 characters)." };
  if (description.length < 20) return { ok: false, message: "Add more detail about the work (at least 20 characters)." };
  if (!Number.isFinite(input.offerTsh) || input.offerTsh < 500) {
    return { ok: false, message: "Offer at least TSh 500." };
  }

  const { error } = await db
    .from("portal_jobs")
    .update({
      category: input.category,
      title,
      description,
      offer_tsh: Math.round(input.offerTsh),
      price_mode: input.priceMode,
      updated_at: new Date().toISOString(),
    })
    .eq("public_id", input.jobPublicId)
    .eq("poster_user_id", input.userId);
  if (error) {
    if (missingJobs(error.message)) {
      return { ok: false, message: "Jobs storage is not ready. Ask staff to apply migration 023." };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function deleteJob(
  db: SupabaseClient,
  input: { userId: string; jobPublicId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await requirePaidDeskForJobs(db, input.userId, "jobsManage");
  if (!plan.ok) return plan;

  const job = await getJobByPublicId(db, input.jobPublicId, input.userId);
  if (!job) return { ok: false, message: "That job was not found." };
  if (!job.isMine) return { ok: false, message: "Only the poster can delete this job." };

  // Clear assignment pointer first so cascade delete on applications cannot block the row.
  await db
    .from("portal_jobs")
    .update({ assigned_application_id: null, updated_at: new Date().toISOString() })
    .eq("public_id", input.jobPublicId)
    .eq("poster_user_id", input.userId);

  const { error } = await db
    .from("portal_jobs")
    .delete()
    .eq("public_id", input.jobPublicId)
    .eq("poster_user_id", input.userId);
  if (error) {
    if (missingJobs(error.message)) {
      return { ok: false, message: "Jobs storage is not ready. Ask staff to apply migration 023." };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

export async function applyToJob(
  db: SupabaseClient,
  input: {
    userId: string;
    jobPublicId: string;
    message: string;
    proposedTsh: number | null;
  },
): Promise<{ ok: true; applicationPublicId: string } | { ok: false; message: string }> {
  const plan = await requirePaidDeskForJobs(db, input.userId, "jobsApply");
  if (!plan.ok) return plan;

  const job = await getJobByPublicId(db, input.jobPublicId, input.userId);
  if (!job) return { ok: false, message: "That job was not found." };
  if (job.status !== "open") return { ok: false, message: "This job is no longer open." };
  if (job.isMine) return { ok: false, message: "You cannot apply to your own job." };

  const message = input.message.trim().slice(0, 2000);
  if (message.length < 10) return { ok: false, message: "Write a short note about how you can help (at least 10 characters)." };

  if (job.priceMode === "fixed" && input.proposedTsh != null) {
    return { ok: false, message: "This job has a fixed offer. Do not propose a different amount." };
  }
  if (job.priceMode === "negotiable" && input.proposedTsh != null) {
    if (!Number.isFinite(input.proposedTsh) || input.proposedTsh < 500) {
      return { ok: false, message: "Proposed amount must be at least TSh 500." };
    }
  }

  const applicantPublicId = await ensurePortalAccount(db, input.userId);
  const publicId = newPublicId();
  const { data, error } = await db
    .from("portal_job_applications")
    .insert({
      public_id: publicId,
      job_id: job.id,
      applicant_user_id: input.userId,
      applicant_public_id: applicantPublicId,
      message,
      proposed_tsh: job.priceMode === "negotiable" && input.proposedTsh != null ? Math.round(input.proposedTsh) : null,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select("public_id")
    .single();
  if (error) {
    if (/unique|23505/i.test(error.message)) {
      return { ok: false, message: "You already applied to this job." };
    }
    if (missingJobs(error.message)) {
      return { ok: false, message: "Jobs storage is not ready. Ask staff to apply migration 023." };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true, applicationPublicId: String(data.public_id) };
}

export async function acceptApplication(
  db: SupabaseClient,
  input: { userId: string; applicationPublicId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: app, error } = await db
    .from("portal_job_applications")
    .select("id, job_id, status")
    .eq("public_id", input.applicationPublicId)
    .maybeSingle();
  if (error || !app) return { ok: false, message: "Application not found." };

  const { data: job } = await db
    .from("portal_jobs")
    .select("id, poster_user_id, status")
    .eq("id", app.job_id)
    .maybeSingle();
  if (!job || String(job.poster_user_id) !== input.userId) {
    return { ok: false, message: "Only the anonymous poster can accept a helper." };
  }
  if (String(job.status) !== "open") return { ok: false, message: "This job is no longer open." };
  if (String(app.status) !== "pending") return { ok: false, message: "This application is not pending." };

  const now = new Date().toISOString();
  await db.from("portal_job_applications").update({ status: "rejected", updated_at: now }).eq("job_id", job.id).eq("status", "pending").neq("id", app.id);
  const { error: accErr } = await db
    .from("portal_job_applications")
    .update({ status: "accepted", updated_at: now })
    .eq("id", app.id)
    .eq("status", "pending");
  if (accErr) return { ok: false, message: accErr.message };

  const { error: jobErr } = await db
    .from("portal_jobs")
    .update({ status: "assigned", assigned_application_id: app.id, updated_at: now })
    .eq("id", job.id)
    .eq("status", "open");
  if (jobErr) return { ok: false, message: jobErr.message };
  return { ok: true };
}

/** Poster closes a request as taken, with no helper picked. Removes it from the open list. */
export async function markJobTaken(
  db: SupabaseClient,
  input: { userId: string; jobPublicId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: job } = await db
    .from("portal_jobs")
    .select("id, poster_user_id, status")
    .eq("public_id", input.jobPublicId)
    .maybeSingle();
  if (!job) return { ok: false, message: "Request not found." };
  if (String(job.poster_user_id) !== input.userId) return { ok: false, message: "Only the poster can mark this as taken." };
  if (String(job.status) !== "open") return { ok: false, message: "This request is already closed." };

  const now = new Date().toISOString();
  const { error: jobErr } = await db
    .from("portal_jobs")
    .update({ status: "assigned", assigned_application_id: null, updated_at: now })
    .eq("id", job.id)
    .eq("status", "open");
  if (jobErr) return { ok: false, message: jobErr.message };

  // Pending offers are closed so their helpers can no longer chat.
  await db
    .from("portal_job_applications")
    .update({ status: "rejected", updated_at: now })
    .eq("job_id", job.id)
    .eq("status", "pending");
  return { ok: true };
}

export async function postJobMessage(
  db: SupabaseClient,
  input: { userId: string; applicationPublicId: string; body: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await requirePaidDeskForJobs(db, input.userId, "jobsMessage");
  if (!plan.ok) return plan;

  const body = input.body.trim().slice(0, 2000);
  if (body.length < 1) return { ok: false, message: "Write a message." };

  const { data: app, error } = await db
    .from("portal_job_applications")
    .select("id, job_id, applicant_user_id, status")
    .eq("public_id", input.applicationPublicId)
    .maybeSingle();
  if (error || !app) return { ok: false, message: "Application not found." };

  const { data: job } = await db.from("portal_jobs").select("poster_user_id").eq("id", app.job_id).maybeSingle();
  if (!job) return { ok: false, message: "Job not found." };

  const isPoster = String(job.poster_user_id) === input.userId;
  const isApplicant = String(app.applicant_user_id) === input.userId;
  if (!isPoster && !isApplicant) return { ok: false, message: "You cannot message on this application." };

  // The helper may only talk once the poster has replied in this thread.
  if (isApplicant) {
    const { count } = await db
      .from("portal_job_messages")
      .select("id", { count: "exact", head: true })
      .eq("application_id", app.id)
      .eq("sender_user_id", String(job.poster_user_id));
    if (!count) return { ok: false, message: "Wait for the poster to reply before you send messages." };
  }

  // Allow talk on pending (negotiate) or accepted (continue work talk). No real names.
  if (!["pending", "accepted"].includes(String(app.status))) {
    return { ok: false, message: "Messaging is closed for this application." };
  }

  const senderPublicId = await ensurePortalAccount(db, input.userId);
  const { error: msgErr } = await db.from("portal_job_messages").insert({
    application_id: app.id,
    sender_user_id: input.userId,
    sender_public_id: senderPublicId,
    body,
  });
  if (msgErr) {
    if (missingJobs(msgErr.message)) {
      return { ok: false, message: "Jobs storage is not ready. Ask staff to apply migration 023." };
    }
    return { ok: false, message: msgErr.message };
  }
  return { ok: true };
}
