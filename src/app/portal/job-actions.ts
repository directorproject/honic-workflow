"use server";

import { revalidatePath } from "next/cache";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { peerHelpAccepted, PEER_HELP_METADATA_KEY, PEER_HELP_RULES_VERSION, peerHelpRulesError } from "@/lib/portal/jobs-peer-help";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  acceptApplication,
  applyToJob,
  markJobTaken,
  createJob,
  deleteJob,
  postJobMessage,
  updateJob,
  type JobPriceMode,
} from "@/lib/portal/jobs";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

import type { PortalResult } from "@/app/portal/auth-actions";

async function requireStudent() {
  const user = await getPortalUser();
  if (!user) throw new Error("Please sign in again.");
  if (isStaffUser(user)) throw new Error("This account cannot use the student portal.");
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
    const result = await applyToJob(db, {
      userId: user.id,
      jobPublicId: String(input.jobPublicId ?? ""),
      message: String(input.message ?? ""),
      proposedTsh: input.proposedTsh == null || Number.isNaN(Number(input.proposedTsh)) ? null : Number(input.proposedTsh),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    revalidatePath(`/portal/jobs/${encodeURIComponent(String(input.jobPublicId))}`);
    return {
      ok: true,
      message: "Offer sent. Chat in the thread if the requester accepts. No real names are shared.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not apply." };
  }
}

export async function portalAcceptJobApplicationAction(applicationPublicId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const result = await acceptApplication(db, {
      userId: user.id,
      applicationPublicId: String(applicationPublicId ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return { ok: true, message: "Helper selected. Keep talking in the job thread. Still no real names." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not accept." };
  }
}

export async function portalJobMessageAction(applicationPublicId: string, body: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    if (!peerHelpAccepted(user)) return { ok: false, message: peerHelpRulesError() };
    const result = await postJobMessage(db, {
      userId: user.id,
      applicationPublicId: String(applicationPublicId ?? ""),
      body: String(body ?? ""),
    });
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/portal/jobs");
    revalidatePath("/portal/jobs/mine");
    return { ok: true, message: "Message sent." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not send message." };
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
