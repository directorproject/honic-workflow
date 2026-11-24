"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { revalidatePortalCatalogue } from "@/lib/portal/portal-catalogue-cache";

import { isStaffUser } from "@/lib/auth-staff";
import {
  deskPlanAmount,
  fulfillMembershipPayment,
  fulfillTitleChangePayment,
  normalizeMembershipMonths,
  type DeskPlanId,
} from "@/lib/payments/fulfill";
import { MAX_MEMBERSHIP_MONTHS } from "@/lib/portal/config";
import {
  defaultPendingExpiresAt,
  expireStalePendingPayments,
  isPendingExpired,
  resolvePendingExpiresAt,
} from "@/lib/payments/pending-expiry";
import { simulatedPaymentsAllowed } from "@/lib/payments/security";
import {
  createMobilePayment,
  fetchSnippePayment,
  makeIdempotencyKey,
  publicWebhookUrl,
  snippeConfigured,
  toSnippePhone,
} from "@/lib/payments/snippe";
import {
  DEFAULT_INSTITUTION,
  OTHER_COURSE_CODE,
  PAYMENT_NETWORKS,
  PAYMENT_PROVIDER,
  PROJECT_CATEGORIES,
  PROJECT_DOCUMENTS_ACCESS_TSH,
  STUDY_LEVELS,
  SUBSCRIPTION_MONTH_TSH,
  TITLE_CHANGE_FEE_TSH,
} from "@/lib/portal/config";
import {
  getPortalUser,
  PROFILE_ONBOARDING_ACADEMIC,
  profileAcademicStepPending,
} from "@/lib/portal/data";
import { hasProjectDocumentsAccess } from "@/lib/portal/document-access";
import {
  PORTAL_PRODUCT_GUIDE_DONE,
  PORTAL_PRODUCT_GUIDE_KEY,
  needsProductGuide,
  productGuidePending,
} from "@/lib/portal/product-guide";
import { chooseTitle, hideTitleFromPeers, loadLiterature } from "@/lib/portal/title-choices";
import { hasActiveDeskPlan, titleHideEntitlement } from "@/lib/portal/title-limits";
import { POLICY_VERSION, TITLE_RULES_VERSION, titleTermsStatus } from "@/lib/portal/title-terms";
import { paymentUnavailableMessage, toUserError } from "@/lib/portal/user-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

import type { PortalResult } from "@/app/portal/auth-actions";
export type { PortalAuthFormState, PortalResult } from "@/app/portal/auth-actions";

function clean(v: unknown, max = 200): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function requireStudent() {
  const user = await getPortalUser();
  if (!user) throw new Error("Please sign in again.");
  if (isStaffUser(user)) throw new Error("This account cannot use the student portal.");
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("Service unavailable. Please try again later.");
  return { user, db };
}

export type ProfileInput = {
  fullName: string;
  phone: string;
  institution: string;
  courseCode: string;
  courseOther: string;
  studyLevel: string;
  studyLevelOther: string;
  projectCategory: string;
  academicYear: string;
};

export type ProfileEssentialsInput = {
  fullName: string;
  phone: string;
};

async function clearProfileOnboardingMeta(userId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  if (!db) return;
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return;
  const existing = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const { portal_profile_onboarding: _drop, ...rest } = existing;
  const merged = { ...rest };
  const { error: adminErr } = await db.auth.admin.updateUserById(userId, { user_metadata: merged });
  if (adminErr) throw new Error(adminErr.message);
  // updateUser merges keys, so a null value is what actually removes the flag from the session user.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.updateUser({ data: { portal_profile_onboarding: null } });
}

async function markProfileAcademicPending(userId: string): Promise<void> {
  const db = getSupabaseAdminClient();
  if (!db) return;
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return;
  const existing = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const merged = { ...existing, portal_profile_onboarding: PROFILE_ONBOARDING_ACADEMIC };
  await db.auth.admin.updateUserById(userId, { user_metadata: merged });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.updateUser({ data: merged });
}

async function defaultActiveCourseCode(db: Awaited<ReturnType<typeof requireStudent>>["db"]): Promise<string> {
  const { data: course } = await db
    .from("courses")
    .select("code")
    .eq("is_active", true)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  return course?.code ? String(course.code) : "ETE";
}

function validateProfileEssentials(input: ProfileEssentialsInput): PortalResult | { fullName: string; phone: string } {
  const fullName = clean(input.fullName, 120);
  if (!fullName) return { ok: false, message: "Enter your full name." };
  const phone = clean(input.phone, 30);
  if (!phone) return { ok: false, message: "Enter your mobile number." };
  if (!toSnippePhone(phone)) {
    return { ok: false, message: "Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX)." };
  }
  return { fullName, phone };
}

/** Step 1: save full name and phone; course defaults until step 2 or skip. */
export async function portalSaveProfileEssentialsAction(input: ProfileEssentialsInput): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const essentials = validateProfileEssentials(input);
    if ("ok" in essentials) return essentials;

    const courseCode = await defaultActiveCourseCode(db);
    const row = {
      user_id: user.id,
      full_name: essentials.fullName,
      phone: essentials.phone,
      institution: DEFAULT_INSTITUTION,
      course_code: courseCode,
      course_other: null,
      study_level: null,
      study_level_other: null,
      project_category: null,
      year_of_study: null,
      academic_year: "2026/2027",
      partner: null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("student_profiles").upsert(row, { onConflict: "user_id" });
    if (error) return { ok: false, message: error.message };
    try {
      const { ensureDeskTrial } = await import("@/lib/portal/desk-trial");
      await ensureDeskTrial(db, user.id);
    } catch {
      /* trial grant is best-effort until migration 044 */
    }
    await markProfileAcademicPending(user.id);
    revalidatePath("/portal");
    revalidatePath("/portal/home");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save your details." };
  }
}

/** Step 2 skip: keep name and phone; course and institution stay on defaults. */
export async function portalSkipProfileAction(): Promise<PortalResult> {
  let userId: string;
  try {
    const { user, db } = await requireStudent();
    userId = user.id;
    if (!profileAcademicStepPending(user)) {
      return { ok: false, message: "Finish your name and phone first." };
    }
    const { data: profile } = await db.from("student_profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle();
    if (!profile?.full_name || !profile?.phone) {
      return { ok: false, message: "Enter your name and phone on the previous step." };
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not continue." };
  }
  await clearProfileOnboardingMeta(userId);
  revalidatePath("/portal");
  revalidatePath("/portal/titles");
  revalidatePath("/portal/home");
  revalidatePath("/portal/packs");
  redirect("/portal/packs?guide=1");
}

/** Marks the mandatory new-user product tour complete on the account. */
export async function portalCompleteProductGuideAction(): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const { data, error } = await db.auth.admin.getUserById(user.id);
    if (error) return { ok: false, message: error.message };
    if (!data.user) return { ok: false, message: "Please sign in again." };
    const merged = {
      ...((data.user.user_metadata ?? {}) as Record<string, unknown>),
      [PORTAL_PRODUCT_GUIDE_KEY]: PORTAL_PRODUCT_GUIDE_DONE,
      portal_product_guide_done_at: new Date().toISOString(),
    };
    const { error: updateError } = await db.auth.admin.updateUserById(user.id, { user_metadata: merged });
    if (updateError) return { ok: false, message: updateError.message };
    const supabase = await createSupabaseServerClient();
    await supabase.auth.updateUser({ data: merged });
    revalidatePath("/portal");
    revalidatePath("/portal/packs");
    revalidatePath("/portal/home");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save tour progress." };
  }
}

/** True when this signed-in student still owes the product tour. */
export async function portalProductGuidePendingAction(): Promise<boolean> {
  try {
    const user = await getPortalUser();
    if (!user || isStaffUser(user)) return false;
    return needsProductGuide(user);
  } catch {
    return false;
  }
}

export async function portalSaveProfileAction(input: ProfileInput): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const { data: existingProfile } = await db
      .from("student_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const isNewProfile = !existingProfile;
    const academicPending = profileAcademicStepPending(user);

    if (isNewProfile) {
      const essentials = validateProfileEssentials(input);
      if ("ok" in essentials) return essentials;
    }

    let courseCode = clean(input.courseCode, 12).toUpperCase();
    if (!courseCode) courseCode = await defaultActiveCourseCode(db);
    const studyLevel = clean(input.studyLevel, 30);
    const phone = clean(input.phone, 30);
    const row = {
      full_name: clean(input.fullName, 120),
      phone: isNewProfile ? phone : phone || null,
      institution: clean(input.institution, 160) || DEFAULT_INSTITUTION,
      course_code: courseCode,
      course_other: courseCode === OTHER_COURSE_CODE ? clean(input.courseOther, 120) || null : null,
      study_level: studyLevel || null,
      study_level_other: studyLevel === "other" ? clean(input.studyLevelOther, 80) || null : null,
      project_category: clean(input.projectCategory, 30) || null,
      year_of_study: null,
      academic_year: clean(input.academicYear, 20) || "2026/2027",
      partner: null,
    };
    if (!row.full_name) return { ok: false, message: "Enter your full name." };
    if ((isNewProfile || academicPending) && !row.phone) return { ok: false, message: "Enter your mobile number." };
    if (row.phone && !toSnippePhone(row.phone)) {
      return { ok: false, message: "Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX)." };
    }
    if (courseCode === OTHER_COURSE_CODE && !row.course_other) {
      return { ok: false, message: "Type the name of your course." };
    }
    if (row.study_level && !STUDY_LEVELS.some((l) => l.value === row.study_level)) {
      return { ok: false, message: "Choose your level of study." };
    }
    if (row.study_level === "other" && !row.study_level_other) {
      return { ok: false, message: "Type your level of study." };
    }
    if (row.project_category && !PROJECT_CATEGORIES.some((c) => c.value === row.project_category)) {
      return { ok: false, message: "Choose your project type." };
    }
    const { data: course } = await db.from("courses").select("code").eq("code", row.course_code).eq("is_active", true).maybeSingle();
    if (!course) return { ok: false, message: "Choose your course." };

    const { data: existing } = await db.from("student_profiles").select("course_code").eq("user_id", user.id).maybeSingle();
    if (existing && existing.course_code !== row.course_code) {
      const { data: held } = await db.from("title_proposals").select("id").eq("selected_by", user.id).maybeSingle();
      if (held) return { ok: false, message: "You already hold a title, so your course cannot change. Contact Honic." };
    }

    const { error } = await db
      .from("student_profiles")
      .upsert({ user_id: user.id, ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return { ok: false, message: error.message };
    try {
      const { ensureDeskTrial } = await import("@/lib/portal/desk-trial");
      await ensureDeskTrial(db, user.id);
    } catch {
      /* trial grant is best-effort until migration 044 */
    }
    const finishedOnboarding = academicPending || isNewProfile;
    if (finishedOnboarding) await clearProfileOnboardingMeta(user.id);
    revalidatePath("/portal");
    revalidatePath("/portal/titles");
    revalidatePath("/portal/home");
    revalidatePath("/portal/packs");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save." };
  }
}

const SELECT_ERRORS: Record<string, string> = {
  no_profile: "Fill in your details first.",
  already_has_title: "You already hold this title, or you reached the hide limit.",
  payment_required: `Pay TSh ${TITLE_CHANGE_FEE_TSH.toLocaleString()} to hide a title from classmates.`,
  payment_required_hide: `Pay TSh ${TITLE_CHANGE_FEE_TSH.toLocaleString()} to hide this title from classmates. Selecting alone only keeps it on your shortlist. This is not a title shop.`,
  not_available: "Someone else just hid this title from your group. Please choose another one.",
};

export async function portalAcceptTitleTermsAction(step: "policy" | "rules"): Promise<PortalResult> {
  try {
    if (step !== "policy" && step !== "rules") return { ok: false, message: "Choose the policy or the title rules." };
    const { user, db } = await requireStudent();
    const { data, error } = await db.auth.admin.getUserById(user.id);
    if (error) return { ok: false, message: error.message };
    if (!data.user) return { ok: false, message: "Please sign in again." };
    const progress = titleTermsStatus(data.user.user_metadata);
    if (step === "rules" && !progress.policyAccepted) return { ok: false, message: "Accept the policy first." };
    const existing = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const now = new Date().toISOString();
    const patch =
      step === "policy"
        ? { portal_policy_version: POLICY_VERSION, portal_policy_accepted_at: now }
        : { title_rules_version: TITLE_RULES_VERSION, title_rules_accepted_at: now };
    const merged = { ...existing, ...patch };
    const { error: updateError } = await db.auth.admin.updateUserById(user.id, {
      user_metadata: merged,
    });
    if (updateError) return { ok: false, message: updateError.message };
    const supabase = await createSupabaseServerClient();
    await supabase.auth.updateUser({ data: merged });
    revalidatePath("/portal/titles");
    if (step === "rules") revalidatePath("/portal/packs");
    return { ok: true, message: step === "rules" ? "plans_next" : undefined };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save your acceptance." };
  }
}

export async function portalChooseTitleAction(proposalId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const { data: row, error } = await db.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!row) return { ok: false, message: "Fill in your details first." };
    const profile = {
      fullName: String(row.full_name),
      regNo: row.reg_no ? String(row.reg_no) : null,
      phone: String(row.phone),
      institution: String(row.institution),
      courseCode: String(row.course_code),
      courseOther: row.course_other ? String(row.course_other) : null,
      studyLevel: row.study_level ? String(row.study_level) : null,
      studyLevelOther: row.study_level_other ? String(row.study_level_other) : null,
      projectCategory: row.project_category ? String(row.project_category) : null,
      yearOfStudy: row.year_of_study ? String(row.year_of_study) : null,
      academicYear: String(row.academic_year),
      partner: row.partner ? String(row.partner) : null,
      trackedProjectId: row.tracked_project_id ? String(row.tracked_project_id) : null,
      changeCredits: Number(row.change_credits ?? 0),
      deskExpiresAt: row.desk_expires_at ? String(row.desk_expires_at) : null,
      deskPlan: row.desk_plan ? String(row.desk_plan) : null,
    };
    await chooseTitle(db, user.id, profile, proposalId);
    revalidatePortalCatalogue(user.id);
    revalidatePath("/portal");
    revalidatePath("/portal/titles");
    revalidatePath(`/portal/titles/${encodeURIComponent(proposalId)}`);
    revalidatePath("/portal/titles/mine");
    revalidatePath("/titles");
    return {
      ok: true,
      message:
        "Title added to your shortlist. Classmates can still see it until you hide it (paid plan free hides, or pay to hide).",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not select this title.";
    return { ok: false, message: SELECT_ERRORS[message] ?? message };
  }
}

/**
 * One-step: shortlist if needed, then hide from classmates using a free plan hide or hide credit.
 * If payment is required, returns payment_required_hide so the client opens checkout.
 */
export async function portalOwnAndHideTitleAction(proposalId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const { data: row, error } = await db.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!row) return { ok: false, message: "Fill in your details first." };
    const profile = {
      fullName: String(row.full_name),
      regNo: row.reg_no ? String(row.reg_no) : null,
      phone: String(row.phone),
      institution: String(row.institution),
      courseCode: String(row.course_code),
      courseOther: row.course_other ? String(row.course_other) : null,
      studyLevel: row.study_level ? String(row.study_level) : null,
      studyLevelOther: row.study_level_other ? String(row.study_level_other) : null,
      projectCategory: row.project_category ? String(row.project_category) : null,
      yearOfStudy: row.year_of_study ? String(row.year_of_study) : null,
      academicYear: String(row.academic_year),
      partner: row.partner ? String(row.partner) : null,
      trackedProjectId: row.tracked_project_id ? String(row.tracked_project_id) : null,
      changeCredits: Number(row.change_credits ?? 0),
      deskExpiresAt: row.desk_expires_at ? String(row.desk_expires_at) : null,
      deskPlan: row.desk_plan ? String(row.desk_plan) : null,
    };

    const review = await loadLiterature(db, user.id, profile, { includeBriefs: false });
    const mine = review.mine.find((t) => t.id === String(proposalId).trim());
    if (!mine) {
      await chooseTitle(db, user.id, profile, proposalId);
    } else if (mine.isHiddenFromPeers) {
      return { ok: true, message: "This title is already yours and hidden from classmates." };
    }

    // Refresh credits/plan after possible select.
    const { data: fresh } = await db
      .from("student_profiles")
      .select("change_credits, desk_expires_at, desk_plan")
      .eq("user_id", user.id)
      .maybeSingle();
    if (fresh) {
      profile.changeCredits = Number(fresh.change_credits ?? 0);
      profile.deskExpiresAt = fresh.desk_expires_at ? String(fresh.desk_expires_at) : null;
      profile.deskPlan = fresh.desk_plan ? String(fresh.desk_plan) : null;
    }

    await hideTitleFromPeers(db, user.id, profile, proposalId);
    revalidatePortalCatalogue();
    revalidatePath("/portal");
    revalidatePath("/portal/titles");
    revalidatePath(`/portal/titles/${encodeURIComponent(proposalId)}`);
    revalidatePath("/portal/home");
    return {
      ok: true,
      message: "This title is yours and hidden from classmates at your institution / course / level.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update this title.";
    return { ok: false, message: SELECT_ERRORS[message] ?? message };
  }
}

/** Hide a shortlisted title from classmates (uses plan free hide or a paid hide credit). */
export async function portalHideTitleAction(proposalId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const { data: row, error } = await db.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!row) return { ok: false, message: "Fill in your details first." };
    const profile = {
      fullName: String(row.full_name),
      regNo: row.reg_no ? String(row.reg_no) : null,
      phone: String(row.phone),
      institution: String(row.institution),
      courseCode: String(row.course_code),
      courseOther: row.course_other ? String(row.course_other) : null,
      studyLevel: row.study_level ? String(row.study_level) : null,
      studyLevelOther: row.study_level_other ? String(row.study_level_other) : null,
      projectCategory: row.project_category ? String(row.project_category) : null,
      yearOfStudy: row.year_of_study ? String(row.year_of_study) : null,
      academicYear: String(row.academic_year),
      partner: row.partner ? String(row.partner) : null,
      trackedProjectId: row.tracked_project_id ? String(row.tracked_project_id) : null,
      changeCredits: Number(row.change_credits ?? 0),
      deskExpiresAt: row.desk_expires_at ? String(row.desk_expires_at) : null,
      deskPlan: row.desk_plan ? String(row.desk_plan) : null,
    };
    await hideTitleFromPeers(db, user.id, profile, proposalId);
    revalidatePortalCatalogue();
    revalidatePath("/portal");
    revalidatePath("/portal/titles");
    revalidatePath(`/portal/titles/${encodeURIComponent(proposalId)}`);
    revalidatePath("/portal/home");
    return {
      ok: true,
      message: "Hidden from classmates at your institution / course / level. Others outside your group can still read it.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not hide this title.";
    return { ok: false, message: SELECT_ERRORS[message] ?? message };
  }
}

export async function portalSelectTitleAction(proposalId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const account = await db.auth.admin.getUserById(user.id);
    if (account.error) return { ok: false, message: account.error.message };
    if (!titleTermsStatus(account.data.user?.user_metadata).accepted) {
      return { ok: false, message: "Accept the title rules before you take a title." };
    }
    const { data, error } = await db.rpc("portal_select_title", { p_user: user.id, p_proposal: String(proposalId) });
    if (error) return { ok: false, message: error.message };
    const r = (data ?? {}) as { ok?: boolean; error?: string };
    if (!r.ok) return { ok: false, message: SELECT_ERRORS[r.error ?? ""] ?? "Could not select this title." };
    revalidatePath("/portal");
    revalidatePath("/titles");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not select this title." };
  }
}

const PAY_ERRORS: Record<string, string> = {
  no_profile: "Fill in your details first.",
  project_started: "Your project has started, so the title cannot change here. Contact Honic.",
  no_title: "You do not hold a title right now.",
};

function parsePayContact(network: string, phone: string): PortalResult | { net: string; tel: string } {
    const net = clean(network, 40);
    if (!(PAYMENT_NETWORKS as readonly string[]).includes(net)) return { ok: false, message: "Choose a payment network." };
    const tel = clean(phone, 20).replace(/\s/g, "");
    if (!/^(\+?255|0)\d{9}$/.test(tel)) return { ok: false, message: "Enter a valid Tanzanian mobile number." };
  return { net, tel };
}


function snippeLive(): boolean {
  return PAYMENT_PROVIDER === "snippe" && snippeConfigured();
}

function splitName(full: string | null | undefined): { firstname: string; lastname: string } {
  const parts = String(full ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstname: "Student", lastname: "Portal" };
  if (parts.length === 1) return { firstname: parts[0], lastname: "Student" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

/** Pay to release one held title and get a credit to pick a replacement (Snippe USSD push). */
export async function portalPayForChangeAction(network: string, phone: string, titleId?: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const contact = parsePayContact(network, phone);
    if ("ok" in contact) return contact;
    if (!toSnippePhone(contact.tel)) {
      return { ok: false, message: "Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX)." };
    }

    const { data: profile } = await db
      .from("student_profiles")
      .select("tracked_project_id, change_credits, full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) return { ok: false, message: PAY_ERRORS.no_profile };
    if (profile.tracked_project_id) return { ok: false, message: PAY_ERRORS.project_started };

    const { count: heldCount } = await db
      .from("title_selections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("released_at", null);
    if ((heldCount ?? 0) < 1) {
      return { ok: false, message: "Hide at least one title first, then you can pay to change it." };
    }

    let q = db.from("title_selections").select("id, proposal_id, title").eq("user_id", user.id).is("released_at", null);
    const wanted = String(titleId ?? "").trim();
    if (wanted) {
      if (wanted.startsWith("earlier:")) {
        const idPart = wanted.slice("earlier:".length).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
        q = q.ilike("title", `earlier:${idPart}|%`);
      } else {
        q = q.eq("proposal_id", wanted);
      }
    }
    const { data: held, error: heldError } = await q.order("selected_at", { ascending: true }).limit(1).maybeSingle();
    if (heldError) return { ok: false, message: heldError.message };
    if (!held) return { ok: false, message: PAY_ERRORS.no_title };

    const reference = makeIdempotencyKey("CHG");
    const live = snippeLive();

    if (!live && PAYMENT_PROVIDER === "snippe") {
      return { ok: false, message: paymentUnavailableMessage() };
    }
    if (!live && !simulatedPaymentsAllowed()) {
      return { ok: false, message: paymentUnavailableMessage() };
    }

    // Block parallel pending charges for the same slot (anti double-spend).
    await expireStalePendingPayments(db, { userId: user.id, selectionId: String(held.id) });
    const { data: openPay } = await db
      .from("title_change_payments")
      .select("id, reference, created_at, expires_at")
      .eq("user_id", user.id)
      .eq("selection_id", held.id)
      .eq("status", "pending")
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
        message: `A payment prompt is already open (ref ${openPay.reference}). Check your phone before it expires (~15 min), then retry if needed.`,
      };
    }

    const pendingExpires = live ? defaultPendingExpiresAt() : null;
    const { data: paymentRow, error: insertError } = await db
      .from("title_change_payments")
      .insert({
        user_id: user.id,
        amount: TITLE_CHANGE_FEE_TSH,
        currency: "TZS",
        provider: live ? "snippe" : "simulated",
        network: contact.net,
        phone: contact.tel,
        status: live ? "pending" : "paid",
        reference,
        purpose: "title_change",
        selection_id: held.id,
        expires_at: pendingExpires,
        paid_at: live ? null : new Date().toISOString(),
      })
      .select("id, user_id, selection_id, status, reference, amount")
      .single();
    if (insertError) {
      if (/pending_selection|unique|23505/i.test(insertError.message)) {
        return {
          ok: true,
          message: "A payment is already pending for this title. Check your phone for the prompt.",
        };
      }
      if (/selection_id|schema cache|column/i.test(insertError.message)) {
        return {
          ok: false,
          message: "Payment storage needs an update. Ask Honic to run SQL migrations 013 and 018.",
        };
      }
      return { ok: false, message: insertError.message };
    }

    if (live) {
      try {
        const name = splitName(profile.full_name);
        const payment = await createMobilePayment({
          amountTsh: TITLE_CHANGE_FEE_TSH,
          phoneNumber: contact.tel,
          customer: { ...name, email: user.email || "student@honiccompany.com" },
          orderId: reference,
          webhookUrl: publicWebhookUrl(),
          idempotencyKey: reference,
          metadata: { purpose: "title_change" },
        });
        const expiresAt = resolvePendingExpiresAt(payment.expiresAt);
        await db
          .from("title_change_payments")
          .update({ provider_txn_id: payment.reference, network: contact.net, expires_at: expiresAt })
          .eq("id", paymentRow.id);
      } catch (err) {
        await db.from("title_change_payments").update({ status: "failed" }).eq("id", paymentRow.id);
        return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
      }

      revalidatePath("/portal");
      revalidatePath("/portal/titles");
      return {
        ok: true,
        message: `Check your phone for the mobile-money prompt (ref ${reference}). Enter your PIN before it expires (about 15 minutes). Your title slot opens when payment is confirmed.`,
      };
    }

    const fulfilled = await fulfillTitleChangePayment(db, {
      id: String(paymentRow.id),
      user_id: user.id,
      selection_id: String(held.id),
      status: "pending",
      reference,
      amount: TITLE_CHANGE_FEE_TSH,
    });
    if (!fulfilled.ok) return { ok: false, message: toUserError(fulfilled.message, paymentUnavailableMessage()) };

    revalidatePath("/portal");
    revalidatePath("/portal/titles");
    revalidatePath("/titles");
    return {
      ok: true,
      message: `Simulated payment received (reference ${reference}). That slot is open again. Pick a free replacement from final year titles.`,
    };
  } catch (err) {
    return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
  }
}

/**
 * Buy peer-hide protection (TSh EXTRA_TITLE_HIDE_FEE).
 * Pass titleId to hide that shortlisted title after payment; otherwise credit is banked.
 */
export async function portalPayForHideAction(network: string, phone: string, titleId?: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const contact = parsePayContact(network, phone);
    if ("ok" in contact) return contact;
    if (!toSnippePhone(contact.tel)) {
      return { ok: false, message: "Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX)." };
    }

    const { data: profile } = await db
      .from("student_profiles")
      .select("full_name, change_credits, desk_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) return { ok: false, message: PAY_ERRORS.no_profile };

    const [{ count: selectedCount }, { count: hiddenCount }] = await Promise.all([
      db.from("title_selections").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("released_at", null),
      db
        .from("title_selections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("released_at", null)
        .not("hidden_at", "is", null),
    ]);

    const entitlement = titleHideEntitlement({
      deskExpiresAt: profile.desk_expires_at ? String(profile.desk_expires_at) : null,
      changeCredits: Number(profile.change_credits ?? 0),
      selectedCount: selectedCount ?? 0,
      hiddenCount: hiddenCount ?? 0,
    });
    if (!entitlement.needsPayment) {
      return {
        ok: true,
        message: entitlement.freeRemaining > 0
          ? `You still have ${entitlement.freeRemaining} free hide${entitlement.freeRemaining === 1 ? "" : "s"} on your plan. Use Hide from classmates without paying.`
          : "You already have a hide credit. Open the title and tap Hide from classmates.",
      };
    }

    let selectionId: string | null = null;
    const wanted = String(titleId ?? "").trim();
    if (wanted) {
      let q = db.from("title_selections").select("id, hidden_at").eq("user_id", user.id).is("released_at", null);
      if (wanted.startsWith("earlier:")) {
        const idPart = wanted.slice("earlier:".length).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
        q = q.ilike("title", `earlier:${idPart}|%`);
      } else {
        q = q.eq("proposal_id", wanted);
      }
      const { data: sel } = await q.maybeSingle();
      if (!sel) return { ok: false, message: "Select this title first, then pay to hide it from classmates." };
      if (sel.hidden_at) return { ok: true, message: "This title is already hidden from classmates." };
      selectionId = String(sel.id);
    }

    const reference = makeIdempotencyKey("HID");
    const live = snippeLive();
    if (!live && PAYMENT_PROVIDER === "snippe") {
      return { ok: false, message: paymentUnavailableMessage() };
    }
    if (!live && !simulatedPaymentsAllowed()) {
      return { ok: false, message: paymentUnavailableMessage() };
    }

    await expireStalePendingPayments(db, { userId: user.id, referencePrefix: "HID" });
    const { data: openPay } = await db
      .from("title_change_payments")
      .select("id, reference, created_at, expires_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .ilike("reference", "HID%")
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
        message: `A hide payment is already open (ref ${openPay.reference}). Check your phone before it expires, then retry if needed.`,
      };
    }

    const pendingExpires = live ? defaultPendingExpiresAt() : null;
    const { data: paymentRow, error: insertError } = await db
      .from("title_change_payments")
      .insert({
        user_id: user.id,
        amount: TITLE_CHANGE_FEE_TSH,
        currency: "TZS",
        provider: live ? "snippe" : "simulated",
        network: contact.net,
        phone: contact.tel,
        status: live ? "pending" : "paid",
        reference,
        purpose: "title_hide",
        selection_id: selectionId,
        expires_at: pendingExpires,
        paid_at: live ? null : new Date().toISOString(),
      })
      .select("id, user_id, selection_id, status, reference, amount")
      .single();
    if (insertError) return { ok: false, message: insertError.message };

    if (live) {
      try {
        const name = splitName(profile.full_name);
        const payment = await createMobilePayment({
          amountTsh: TITLE_CHANGE_FEE_TSH,
          phoneNumber: contact.tel,
          customer: { ...name, email: user.email || "student@honiccompany.com" },
          orderId: reference,
          webhookUrl: publicWebhookUrl(),
          idempotencyKey: reference,
          metadata: { purpose: "title_hide", ...(wanted ? { title_id: wanted } : {}) },
        });
        const expiresAt = resolvePendingExpiresAt(payment.expiresAt);
        await db
          .from("title_change_payments")
          .update({ provider_txn_id: payment.reference, network: contact.net, expires_at: expiresAt })
          .eq("id", paymentRow.id);
      } catch (err) {
        await db.from("title_change_payments").update({ status: "failed" }).eq("id", paymentRow.id);
        return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
      }
      revalidatePath("/portal");
      revalidatePath("/portal/titles");
      return {
        ok: true,
        message: selectionId
          ? `Check your phone (ref ${reference}). Approve before it expires (~15 min). After payment, this title is hidden from classmates.`
          : `Check your phone (ref ${reference}). Approve before it expires (~15 min). After payment you get 1 hide credit.`,
      };
    }

    const fulfilled = await fulfillTitleChangePayment(db, {
      id: String(paymentRow.id),
      user_id: user.id,
      selection_id: selectionId,
      status: "pending",
      reference,
      amount: TITLE_CHANGE_FEE_TSH,
    });
    if (!fulfilled.ok) return { ok: false, message: toUserError(fulfilled.message, paymentUnavailableMessage()) };

    revalidatePath("/portal");
    revalidatePath("/portal/titles");
    return {
      ok: true,
      message: selectionId
        ? `Simulated hide payment received (ref ${reference}). This title is now hidden from classmates.`
        : `Simulated hide payment received (ref ${reference}). You have 1 hide credit. Open a shortlisted title and hide it.`,
    };
  } catch (err) {
    return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
  }
}

/** Buy or renew Nexis Desk membership (monthly / semester / year) via Snippe. */
export async function portalPayForMembershipAction(
  plan: string,
  network: string,
  phone: string,
  months?: number,
): Promise<PortalResult> {
  try {
    const planId: DeskPlanId | null =
      plan === "semester" ? "semester" : plan === "year" ? "year" : plan === "monthly" ? "monthly" : null;
    if (!planId) {
      return { ok: false, message: "Choose monthly, semester, or full year membership." };
    }
    const monthCount =
      planId === "monthly" ? normalizeMembershipMonths("monthly", months ?? 1) : 0;
    if (planId === "monthly" && !Number.isFinite(monthCount)) {
      return {
        ok: false,
        message: `Choose between 1 and ${MAX_MEMBERSHIP_MONTHS} months for the monthly plan.`,
      };
    }

    const { user, db } = await requireStudent();
    const contact = parsePayContact(network, phone);
    if ("ok" in contact) return contact;
    if (!toSnippePhone(contact.tel)) {
      return { ok: false, message: "Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX)." };
    }

    const { data: profile } = await db
      .from("student_profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) return { ok: false, message: PAY_ERRORS.no_profile };

    const amount = deskPlanAmount(planId, planId === "monthly" ? monthCount : 1);
    const reference = makeIdempotencyKey(
      planId === "year" ? "MEMY" : planId === "semester" ? "MEMS" : "MEMM",
    );
    const live = snippeLive();

    if (!live && PAYMENT_PROVIDER === "snippe") {
      return { ok: false, message: paymentUnavailableMessage() };
    }
    if (!live && !simulatedPaymentsAllowed()) {
      return { ok: false, message: paymentUnavailableMessage() };
    }

    await expireStalePendingPayments(db, { userId: user.id, referencePrefix: "MEM" });
    const { data: openPay } = await db
      .from("title_change_payments")
      .select("id, reference, created_at, expires_at")
      .eq("user_id", user.id)
      .is("selection_id", null)
      .eq("status", "pending")
      .ilike("reference", "MEM%")
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
        paymentId: String(openPay.id),
        message: "Approve the mobile-money prompt on your phone. We’ll update your plan as soon as payment confirms.",
      };
    }

    const pendingExpires = live ? defaultPendingExpiresAt() : null;
    const { data: paymentRow, error: insertError } = await db
      .from("title_change_payments")
      .insert({
        user_id: user.id,
        amount,
        currency: "TZS",
        provider: live ? "snippe" : "simulated",
        network: contact.net,
        phone: contact.tel,
        status: live ? "pending" : "paid",
        reference,
        purpose: "membership",
        selection_id: null,
        expires_at: pendingExpires,
        paid_at: live ? null : new Date().toISOString(),
      })
      .select("id, user_id, status, reference, amount")
      .single();
    if (insertError) return { ok: false, message: insertError.message };

    if (live) {
      try {
        const name = splitName(profile.full_name);
        const payment = await createMobilePayment({
          amountTsh: amount,
          phoneNumber: contact.tel,
          customer: { ...name, email: user.email || "student@honiccompany.com" },
          orderId: reference,
          webhookUrl: publicWebhookUrl(),
          idempotencyKey: reference,
          metadata:
            planId === "monthly"
              ? { purpose: "membership", plan: planId, months: String(monthCount) }
              : { purpose: "membership", plan: planId },
        });
        const expiresAt = resolvePendingExpiresAt(payment.expiresAt);
        await db
          .from("title_change_payments")
          .update({ provider_txn_id: payment.reference, network: contact.net, expires_at: expiresAt })
          .eq("id", paymentRow.id);
      } catch (err) {
        await db.from("title_change_payments").update({ status: "failed" }).eq("id", paymentRow.id);
        return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
      }
      revalidatePath("/portal");
      revalidatePath("/portal/packs");
      return {
        ok: true,
        awaitingPayment: true,
        paymentId: String(paymentRow.id),
        message: "Approve the mobile-money prompt on your phone. This usually takes under a minute.",
      };
    }

    const fulfilled = await fulfillMembershipPayment(
      db,
      {
        id: String(paymentRow.id),
        user_id: user.id,
        status: "pending",
        reference,
        amount,
      },
      planId,
      undefined,
      planId === "monthly" ? monthCount : null,
    );
    if (!fulfilled.ok) return { ok: false, message: toUserError(fulfilled.message, paymentUnavailableMessage()) };

    revalidatePath("/portal");
    revalidatePath("/portal/packs");
    revalidatePath("/portal/titles");
    const planLabel =
      planId === "monthly"
        ? `${monthCount}-month monthly`
        : planId === "semester"
          ? "semester"
          : "full year";
    return {
      ok: true,
      message: `Payment received. Your ${planLabel} plan is active.`,
    };
  } catch (err) {
    return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
  }
}

export type MembershipPaymentPollState = "pending" | "paid" | "failed" | "expired";

/** Poll membership payment; syncs from Snippe if webhook has not landed yet. */
export async function portalCheckMembershipPaymentAction(paymentId: string): Promise<{
  ok: boolean;
  state: MembershipPaymentPollState;
  message: string;
  deskExpiresAt?: string | null;
  deskPlan?: string | null;
}> {
  try {
    const { user, db } = await requireStudent();
    const id = String(paymentId ?? "").trim();
    if (!id) return { ok: false, state: "failed", message: "Missing payment." };

    const { data: pay } = await db
      .from("title_change_payments")
      .select("id, user_id, status, reference, amount, purpose, provider_txn_id, expires_at, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!pay) return { ok: false, state: "failed", message: "Payment not found." };

    const purpose = String(pay.purpose ?? "").toLowerCase();
    const ref = String(pay.reference ?? "").toUpperCase();
    if (purpose !== "membership" && !ref.startsWith("MEM")) {
      return { ok: false, state: "failed", message: "Not a membership payment." };
    }

    async function deskSnapshot() {
      const { data: profile } = await db
        .from("student_profiles")
        .select("desk_expires_at, desk_plan")
        .eq("user_id", user.id)
        .maybeSingle();
      return {
        deskExpiresAt: profile?.desk_expires_at ? String(profile.desk_expires_at) : null,
        deskPlan: profile?.desk_plan ? String(profile.desk_plan) : null,
      };
    }

    if (String(pay.status) === "paid") {
      const desk = await deskSnapshot();
      return {
        ok: true,
        state: "paid",
        message: "Payment confirmed. Your plan is active.",
        ...desk,
      };
    }
    if (String(pay.status) === "failed") {
      return { ok: false, state: "failed", message: "Payment failed or was cancelled. You can try again." };
    }

    const expired = isPendingExpired({
      status: String(pay.status),
      expiresAt: pay.expires_at ? String(pay.expires_at) : null,
      createdAt: pay.created_at ? String(pay.created_at) : null,
    });

    // Recover missed webhooks: confirm with Snippe, then fulfill.
    const snippeRef = pay.provider_txn_id ? String(pay.provider_txn_id) : "";
    if (snippeRef && snippeConfigured()) {
      const live = await fetchSnippePayment(snippeRef);
      if (live?.status === "completed") {
        const planGuess = ref.startsWith("MEMY")
          ? "year"
          : ref.startsWith("MEMS")
            ? "semester"
            : "monthly";
        const months =
          planGuess === "monthly" && Number(pay.amount) >= SUBSCRIPTION_MONTH_TSH
            ? Math.round(Number(pay.amount) / SUBSCRIPTION_MONTH_TSH)
            : 1;
        const fulfilled = await fulfillMembershipPayment(
          db,
          {
            id: String(pay.id),
            user_id: user.id,
            status: String(pay.status),
            reference: String(pay.reference),
            amount: Number(pay.amount),
          },
          planGuess,
          {
            paidAmount: live.amount,
            providerTxnId: snippeRef,
            webhookEventId: null,
          },
          planGuess === "monthly" ? months : null,
        );
        if (fulfilled.ok) {
          revalidatePath("/portal");
          revalidatePath("/portal/packs");
          revalidatePath("/portal/titles");
          const desk = await deskSnapshot();
          return {
            ok: true,
            state: "paid",
            message: "Payment confirmed. Your plan is active.",
            ...desk,
          };
        }
      }
      if (live && ["failed", "cancelled", "expired"].includes(live.status)) {
        await db.from("title_change_payments").update({ status: "failed" }).eq("id", pay.id).eq("status", "pending");
        return { ok: false, state: "failed", message: "Payment failed or was cancelled. You can try again." };
      }
    }

    if (expired) {
      await db.from("title_change_payments").update({ status: "failed" }).eq("id", pay.id).eq("status", "pending");
      return {
        ok: false,
        state: "expired",
        message: "The payment prompt expired. Try again and approve on your phone promptly.",
      };
    }

    return {
      ok: true,
      state: "pending",
      message: "Waiting for you to approve on your phone…",
    };
  } catch (err) {
    return {
      ok: false,
      state: "failed",
      message: toUserError(err, "Could not check payment status."),
    };
  }
}

/** Unlock catalogue / published project source files (view-only) via Snippe. */
export async function portalPayForDocumentsAction(network: string, phone: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const contact = parsePayContact(network, phone);
    if ("ok" in contact) return contact;
    if (!toSnippePhone(contact.tel)) {
      return { ok: false, message: "Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX)." };
    }

    const { data: profile } = await db
      .from("student_profiles")
      .select("full_name, desk_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) return { ok: false, message: PAY_ERRORS.no_profile };

    const deskExpiresAt = profile.desk_expires_at ? String(profile.desk_expires_at) : null;
    if (hasActiveDeskPlan(deskExpiresAt)) {
      return { ok: true, message: "Your active Nexis Desk plan already unlocks project source files." };
    }
    if (await hasProjectDocumentsAccess(db, { userId: user.id, deskExpiresAt })) {
      return { ok: true, message: "Project documents are already unlocked on your account." };
    }

    const amount = PROJECT_DOCUMENTS_ACCESS_TSH;
    const reference = makeIdempotencyKey("DOC");
    const live = snippeLive();
    if (!live && PAYMENT_PROVIDER === "snippe") {
      return { ok: false, message: paymentUnavailableMessage() };
    }
    if (!live && !simulatedPaymentsAllowed()) {
      return { ok: false, message: paymentUnavailableMessage() };
    }

    await expireStalePendingPayments(db, { userId: user.id, referencePrefix: "DOC" });
    const { data: openPay } = await db
      .from("title_change_payments")
      .select("id, reference, created_at, expires_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .ilike("reference", "DOC%")
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
        message: `A documents payment is already open (ref ${openPay.reference}). Check your phone before it expires.`,
      };
    }

    const pendingExpires = live ? defaultPendingExpiresAt() : null;
    const { data: paymentRow, error: insertError } = await db
      .from("title_change_payments")
      .insert({
        user_id: user.id,
        amount,
        currency: "TZS",
        provider: live ? "snippe" : "simulated",
        network: contact.net,
        phone: contact.tel,
        status: live ? "pending" : "paid",
        reference,
        purpose: "project_documents",
        selection_id: null,
        expires_at: pendingExpires,
        paid_at: live ? null : new Date().toISOString(),
      })
      .select("id, user_id, status, reference, amount")
      .single();
    if (insertError) return { ok: false, message: insertError.message };

    if (live) {
      try {
        const name = splitName(profile.full_name);
        const payment = await createMobilePayment({
          amountTsh: amount,
          phoneNumber: contact.tel,
          customer: { ...name, email: user.email || "student@honiccompany.com" },
          orderId: reference,
          webhookUrl: publicWebhookUrl(),
          idempotencyKey: reference,
          metadata: { purpose: "project_documents" },
        });
        const expiresAt = resolvePendingExpiresAt(payment.expiresAt);
        await db
          .from("title_change_payments")
          .update({ provider_txn_id: payment.reference, network: contact.net, expires_at: expiresAt })
          .eq("id", paymentRow.id);
      } catch (err) {
        await db.from("title_change_payments").update({ status: "failed" }).eq("id", paymentRow.id);
        return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
      }
      revalidatePath("/portal/titles");
      revalidatePath("/portal/packs");
      return {
        ok: true,
        message: `Check your phone for the mobile-money prompt (ref ${reference}). Approve before it expires (~15 min). Source files unlock when payment is confirmed.`,
      };
    }

    const fulfilled = await fulfillTitleChangePayment(db, {
      id: String(paymentRow.id),
      user_id: user.id,
      selection_id: null,
      status: "pending",
      reference,
      amount,
    });
    if (!fulfilled.ok) return { ok: false, message: toUserError(fulfilled.message, paymentUnavailableMessage()) };

    revalidatePath("/portal/titles");
    revalidatePath("/portal/packs");
    return {
      ok: true,
      message: `Simulated payment received (ref ${reference}). Project source files are unlocked for viewing.`,
    };
  } catch (err) {
    return { ok: false, message: toUserError(err, paymentUnavailableMessage()) };
  }
}

/** @deprecated Prefer portalPayForHideAction. */
export async function portalPayForSelectAction(network: string, phone: string): Promise<PortalResult> {
  return portalPayForHideAction(network, phone);
}

/**
 * Save a mobile-money payout account after a title claim is confirmed.
 * Account holder name must match the registered profile name. Later edits lock and require Help desk.
 */
export async function portalSavePayoutAccountAction(
  network: string,
  phone: string,
  accountName: string,
): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const { data: profile } = await db
      .from("student_profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.full_name) {
      return { ok: false, message: "Complete your account profile first, then add a payout account." };
    }

    const { userHasConfirmedClaim, validatePayoutInput, upsertPayoutAccount } = await import(
      "@/lib/portal/payout-accounts"
    );
    const eligible = await userHasConfirmedClaim(db, user.id);
    if (!eligible.ok) return { ok: false, message: eligible.reason };

    const validated = validatePayoutInput({
      network,
      phone,
      accountName,
      registeredName: String(profile.full_name),
    });
    if (!validated.ok) return { ok: false, message: validated.message };

    const saved = await upsertPayoutAccount(db, {
      userId: user.id,
      claimId: eligible.claimId,
      network: validated.network,
      phone: validated.phone,
      accountName: validated.accountName,
      registeredName: String(profile.full_name),
    });
    if (!saved.ok) return { ok: false, message: saved.message };

    revalidatePath("/portal");
    revalidatePath("/portal/home");
    return {
      ok: true,
      message: "Payout account saved. The holder name matches your registered portal name. To change it later, contact Help desk.",
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save payout account." };
  }
}
