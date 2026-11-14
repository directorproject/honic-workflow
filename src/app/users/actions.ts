"use server";

import { revalidatePath } from "next/cache";

import { isStaffUser, requireStaffActor } from "@/lib/auth-staff";
import {
  ensurePortalAccount,
  isPublicId,
  resolveStaffUserRef,
  writeStaffAudit,
} from "@/lib/portal/accounts";
import { getSharePublicOriginFromEnv } from "@/lib/share-link-origin";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";

function db() {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("Secure database access is not configured.");
  return supabase;
}

function revalidateUserPages(publicId?: string) {
  revalidatePath("/users");
  revalidatePath("/users/requests");
  if (publicId && isPublicId(publicId)) revalidatePath(`/users/${publicId}`);
  revalidatePath("/students");
  revalidatePath("/projects");
  revalidatePath("/titles");
  revalidatePath("/portal");
  revalidatePath("/portal/titles");
}

async function requireStudentByPublicId(publicId: string) {
  const actor = await requireStaffActor();
  const supabase = db();
  const resolved = await resolveStaffUserRef(supabase, publicId);
  if (!resolved || !isPublicId(resolved.publicId)) throw new Error("That account was not found.");
  const { data, error } = await supabase.auth.admin.getUserById(resolved.userId);
  if (error) throw new Error(error.message);
  const user = data.user;
  if (!user) throw new Error("That account was not found.");
  if (isStaffUser(user)) throw new Error("Staff accounts are not changed from this page.");
  return { actor, user, publicId: resolved.publicId, supabase };
}

/** Emails the student a link to choose a new portal password. */
export async function sendStudentPasswordResetAction(publicId: string) {
  const { actor, user, publicId: pid, supabase } = await requireStudentByPublicId(publicId);
  const email = user.email?.trim().toLowerCase();
  if (!email) throw new Error("This account has no email address.");

  const origin = getSharePublicOriginFromEnv() || "https://share.honiccompany.com";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/portal/auth/callback?next=/portal/reset`,
  });
  if (error) throw new Error(error.message);
  await writeStaffAudit(supabase, {
    actorId: actor.id,
    action: "password_reset",
    targetUserId: user.id,
    targetPublicId: pid,
  });
}

/** Stops or restores portal sign-in. A blocked student cannot sign in. */
export async function setStudentSignInBlockedAction(publicId: string, blocked: boolean) {
  const { actor, user, publicId: pid, supabase } = await requireStudentByPublicId(publicId);
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    ban_duration: blocked ? "876000h" : "none",
  });
  if (error) throw new Error(error.message);
  await writeStaffAudit(supabase, {
    actorId: actor.id,
    action: blocked ? "block_sign_in" : "unblock_sign_in",
    targetUserId: user.id,
    targetPublicId: pid,
  });
  revalidateUserPages(pid);
}

/** Marks the student's email as confirmed so they can sign in. */
export async function confirmStudentEmailAction(publicId: string) {
  const { actor, user, publicId: pid, supabase } = await requireStudentByPublicId(publicId);
  const { error } = await supabase.auth.admin.updateUserById(user.id, { email_confirm: true });
  if (error) throw new Error(error.message);
  await writeStaffAudit(supabase, {
    actorId: actor.id,
    action: "confirm_email",
    targetUserId: user.id,
    targetPublicId: pid,
  });
  revalidateUserPages(pid);
}

/** Gives the student one free title change. */
export async function grantTitleChangeCreditAction(publicId: string) {
  const { actor, user, publicId: pid, supabase } = await requireStudentByPublicId(publicId);
  const { data: profile, error: readError } = await supabase
    .from("student_profiles")
    .select("change_credits")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!profile) throw new Error("This student has not saved their details yet.");
  const next = Number(profile.change_credits ?? 0) + 1;
  const { error } = await supabase
    .from("student_profiles")
    .update({ change_credits: next, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  await writeStaffAudit(supabase, {
    actorId: actor.id,
    action: "grant_change_credit",
    targetUserId: user.id,
    targetPublicId: pid,
    meta: { change_credits: next },
  });
  revalidateUserPages(pid);
}

/** Puts the student's selected title back on the list. The account stays. */
export async function releaseStudentTitleAction(publicId: string) {
  const { actor, user, publicId: pid, supabase } = await requireStudentByPublicId(publicId);
  const now = new Date().toISOString();
  const [{ data: title, error: readError }, { data: picks, error: pickError }] = await Promise.all([
    supabase.from("title_proposals").select("id").eq("selected_by", user.id).maybeSingle(),
    supabase.from("title_selections").select("id").eq("user_id", user.id).is("released_at", null),
  ]);
  if (readError) throw new Error(readError.message);
  if (pickError) throw new Error(pickError.message);
  if (!title && !(picks ?? []).length) throw new Error("This student has no selected title.");

  if (title) {
    const { error } = await supabase
      .from("title_proposals")
      .update({ status: "available", assigned_to: null, assigned_at: null, selected_by: null, updated_at: now })
      .eq("id", title.id);
    if (error) throw new Error(error.message);
  }

  const { error: releaseError } = await supabase
    .from("title_selections")
    .update({ released_at: now, release_reason: "released_by_staff" })
    .eq("user_id", user.id)
    .is("released_at", null);
  if (releaseError) throw new Error(releaseError.message);

  const { data: profile } = await supabase.from("student_profiles").select("change_credits").eq("user_id", user.id).maybeSingle();
  if (profile) {
    await supabase
      .from("student_profiles")
      .update({ change_credits: Number(profile.change_credits ?? 0) + 1, updated_at: now })
      .eq("user_id", user.id);
  }
  await writeStaffAudit(supabase, {
    actorId: actor.id,
    action: "release_title",
    targetUserId: user.id,
    targetPublicId: pid,
  });
  revalidateUserPages(pid);
}

/** Removes the link between this student and a tracked project. The account stays. */
export async function unlinkStudentProjectAction(publicId: string) {
  const { actor, user, publicId: pid, supabase } = await requireStudentByPublicId(publicId);
  const { error } = await supabase
    .from("student_profiles")
    .update({ tracked_project_id: null, linked_at: null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  await writeStaffAudit(supabase, {
    actorId: actor.id,
    action: "unlink_project",
    targetUserId: user.id,
    targetPublicId: pid,
  });
  revalidateUserPages(pid);
}

/** Deletes a student account and releases any title they had selected. */
export async function removeStudentAccountAction(publicId: string) {
  const { actor, user, publicId: pid, supabase } = await requireStudentByPublicId(publicId);
  const now = new Date().toISOString();

  const { error: titleError } = await supabase
    .from("title_proposals")
    .update({
      status: "available",
      assigned_to: null,
      assigned_at: null,
      selected_by: null,
      updated_at: now,
    })
    .eq("selected_by", user.id);
  if (titleError) throw new Error(titleError.message);

  await supabase
    .from("title_selections")
    .update({ released_at: now, release_reason: "account_removed" })
    .eq("user_id", user.id)
    .is("released_at", null);

  await writeStaffAudit(supabase, {
    actorId: actor.id,
    action: "remove_account",
    targetUserId: user.id,
    targetPublicId: pid,
    meta: { email: user.email ?? null },
  });

  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) throw new Error(error.message);
  revalidateUserPages(pid);
}

/** Ensure a public id exists (used when migrating old UUID bookmarks). */
export async function ensureUserPublicIdAction(userId: string) {
  await requireStaffActor();
  return ensurePortalAccount(db(), userId);
}
