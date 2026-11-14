"use server";

import { revalidatePath } from "next/cache";

import { requireStaffActor } from "@/lib/auth-staff";
import { ensurePortalAccount, isPublicId, writeStaffAudit } from "@/lib/portal/accounts";
import { strongId } from "@/lib/portal/title-claims";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";

async function loadPendingClaimByPublicId(claimPublicId: string) {
  await requireStaffActor();
  const db = getSupabaseServiceRoleClient();
  if (!db) throw new Error("Secure database access is not configured.");
  const pid = String(claimPublicId ?? "").trim().toLowerCase();
  if (!isPublicId(pid)) throw new Error("That request was not found.");
  const { data: claim, error } = await db
    .from("portal_title_claims")
    .select("*")
    .eq("public_id", pid)
    .eq("status", "pending")
    .maybeSingle();
  if (error || !claim) throw new Error(error?.message ?? "That request is no longer waiting.");
  return { db, claim, publicId: pid };
}

async function revalidateClaimPaths(db: Awaited<ReturnType<typeof getSupabaseServiceRoleClient>>, requesterId: string | null) {
  revalidatePath("/titles");
  revalidatePath("/users");
  revalidatePath("/users/requests");
  revalidatePath("/portal");
  revalidatePath("/portal/home");
  revalidatePath("/portal/titles");
  revalidatePath("/portal/titles/mine");
  if (requesterId && db) {
    try {
      const publicId = await ensurePortalAccount(db, String(requesterId));
      revalidatePath(`/users/${publicId}`);
    } catch {
      /* best effort */
    }
  }
}

export async function confirmTitleClaim(formData: FormData) {
  const actor = await requireStaffActor();
  const claimPublicId = String(formData.get("claimPublicId") ?? formData.get("claimId") ?? "");
  const { db, claim, publicId } = await loadPendingClaimByPublicId(claimPublicId);
  const id = String(claim.id);

  if (claim.request_kind === "new") {
    const row = {
      title: String(claim.title),
      summary: claim.explanation ? String(claim.explanation) : null,
      course_code: claim.course_code ? String(claim.course_code) : null,
      institution: claim.institution ? String(claim.institution) : null,
      status: "available",
    };
    let inserted = await db.from("title_proposals").insert({ ...row, public_id: strongId() }).select("id").single();
    if (inserted.error && /public_id/i.test(inserted.error.message)) {
      inserted = await db.from("title_proposals").insert(row).select("id").single();
    }
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "The project could not be added.");
    const { error: updateError } = await db
      .from("portal_title_claims")
      .update({
        status: "confirmed",
        target_kind: "proposal",
        target_id: inserted.data.id,
        confirmed_by: actor.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending");
    if (updateError) throw new Error(updateError.message);
  } else {
    if (claim.request_kind === "appeal" && claim.target_kind && claim.target_id) {
      await db
        .from("portal_title_claims")
        .update({
          status: "rejected",
          confirmed_by: actor.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("target_kind", claim.target_kind)
        .eq("target_id", claim.target_id)
        .eq("status", "confirmed")
        .neq("id", id);
    }

    const { error: updateError } = await db
      .from("portal_title_claims")
      .update({
        status: "confirmed",
        confirmed_by: actor.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending");
    if (updateError) throw new Error(updateError.message);

    await db
      .from("portal_title_claims")
      .update({
        status: "rejected",
        confirmed_by: actor.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq("target_kind", claim.target_kind)
      .eq("target_id", claim.target_id)
      .eq("status", "pending")
      .neq("id", id);
  }

  await writeStaffAudit(db, {
    actorId: actor.id,
    action: "confirm_title_claim",
    targetUserId: claim.requester_id ? String(claim.requester_id) : null,
    targetPublicId: publicId,
    meta: { request_kind: claim.request_kind, title: claim.title },
  });
  await revalidateClaimPaths(db, claim.requester_id ? String(claim.requester_id) : null);
}

export async function rejectTitleClaim(formData: FormData) {
  const actor = await requireStaffActor();
  const claimPublicId = String(formData.get("claimPublicId") ?? formData.get("claimId") ?? "");
  const { db, claim, publicId } = await loadPendingClaimByPublicId(claimPublicId);
  const { error } = await db
    .from("portal_title_claims")
    .update({ status: "rejected", confirmed_by: actor.id, confirmed_at: new Date().toISOString() })
    .eq("id", claim.id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  await writeStaffAudit(db, {
    actorId: actor.id,
    action: "reject_title_claim",
    targetUserId: claim.requester_id ? String(claim.requester_id) : null,
    targetPublicId: publicId,
  });
  await revalidateClaimPaths(db, claim.requester_id ? String(claim.requester_id) : null);
}
