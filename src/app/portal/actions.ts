"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isStaffUser } from "@/lib/auth-staff";
import { PAYMENT_NETWORKS, PAYMENT_PROVIDER, TITLE_CHANGE_FEE_TSH, YEARS_OF_STUDY } from "@/lib/portal/config";
import { getPortalUser } from "@/lib/portal/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type PortalResult = { ok: true; message?: string } | { ok: false; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function clean(v: unknown, max = 200): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function requireStudent() {
  const user = await getPortalUser();
  if (!user) throw new Error("Please sign in again.");
  if (isStaffUser(user)) throw new Error("Staff accounts cannot use the student portal.");
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("Service unavailable. Please try again later.");
  return { user, db };
}

export async function portalSignUpAction(email: string, password: string): Promise<PortalResult> {
  const e = clean(email, 254).toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, message: "Enter a valid email address." };
  if (String(password).length < 8) return { ok: false, message: "Password must be at least 8 characters." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: e,
    password: String(password),
    options: { emailRedirectTo: `${await requestOrigin()}/portal/auth/callback` },
  });
  if (error) return { ok: false, message: error.message };
  if (data.session) {
    revalidatePath("/portal");
    return { ok: true };
  }
  return { ok: true, message: `We sent a confirmation link to ${e}. Open it to finish creating your account.` };
}

export async function portalSignInAction(email: string, password: string): Promise<PortalResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: clean(email, 254).toLowerCase(),
    password: String(password),
  });
  if (error) {
    return {
      ok: false,
      message: /confirm/i.test(error.message) ? "Confirm your email first: open the link we sent you." : "Wrong email or password.",
    };
  }
  if (isStaffUser(data.user)) {
    await supabase.auth.signOut();
    return { ok: false, message: "Staff accounts sign in at inova.honiccompany.com." };
  }
  revalidatePath("/portal");
  return { ok: true };
}

export async function portalGoogleSignInAction(): Promise<PortalResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await requestOrigin()}/portal/auth/callback`, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    return { ok: false, message: error?.message ?? "Google sign-in is not available right now." };
  }
  redirect(data.url);
}

export async function portalSignOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/portal");
}

export async function portalForgotPasswordAction(email: string): Promise<PortalResult> {
  const e = clean(email, 254).toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, message: "Enter a valid email address." };
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(e, {
    redirectTo: `${await requestOrigin()}/portal/auth/callback?next=/portal/reset`,
  });
  return { ok: true, message: `If ${e} has an account, we sent a link to set a new password.` };
}

export async function portalUpdatePasswordAction(password: string): Promise<PortalResult> {
  if (String(password).length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: String(password) });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password updated." };
}

export type ProfileInput = {
  fullName: string;
  regNo: string;
  phone: string;
  institution: string;
  courseCode: string;
  yearOfStudy: string;
  academicYear: string;
  partner: string;
};

export async function portalSaveProfileAction(input: ProfileInput): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const row = {
      full_name: clean(input.fullName, 120),
      reg_no: clean(input.regNo, 40).toUpperCase(),
      phone: clean(input.phone, 30),
      institution: clean(input.institution, 160),
      course_code: clean(input.courseCode, 12).toUpperCase(),
      year_of_study: clean(input.yearOfStudy, 60),
      academic_year: clean(input.academicYear, 20),
      partner: clean(input.partner, 160) || null,
    };
    if (!row.full_name || !row.reg_no || !row.phone || !row.institution || !row.academic_year) {
      return { ok: false, message: "Fill in all required fields." };
    }
    if (!(YEARS_OF_STUDY as readonly string[]).includes(row.year_of_study)) {
      return { ok: false, message: "Choose your year of study." };
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
    if (error) {
      if (error.code === "23505") return { ok: false, message: "This registration number is already registered." };
      return { ok: false, message: error.message };
    }
    revalidatePath("/portal");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save." };
  }
}

const SELECT_ERRORS: Record<string, string> = {
  no_profile: "Fill in your details first.",
  already_has_title: "You already hold a title.",
  payment_required: `Pay the TSh ${TITLE_CHANGE_FEE_TSH.toLocaleString()} change fee to choose another title.`,
  not_available: "Someone else just took this title. Please choose another one.",
};

export async function portalSelectTitleAction(proposalId: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
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

export async function portalPayForChangeAction(network: string, phone: string): Promise<PortalResult> {
  try {
    const { user, db } = await requireStudent();
    const net = clean(network, 40);
    if (!(PAYMENT_NETWORKS as readonly string[]).includes(net)) return { ok: false, message: "Choose a payment network." };
    const tel = clean(phone, 20).replace(/\s/g, "");
    if (!/^(\+?255|0)\d{9}$/.test(tel)) return { ok: false, message: "Enter a valid Tanzanian mobile number." };

    const reference = `SIM-${randomBytes(6).toString("hex").toUpperCase()}`;
    const { data, error } = await db.rpc("portal_pay_for_change", {
      p_user: user.id,
      p_amount: TITLE_CHANGE_FEE_TSH,
      p_provider: PAYMENT_PROVIDER,
      p_network: net,
      p_phone: tel,
      p_reference: reference,
    });
    if (error) return { ok: false, message: error.message };
    const r = (data ?? {}) as { ok?: boolean; error?: string };
    if (!r.ok) return { ok: false, message: PAY_ERRORS[r.error ?? ""] ?? "Payment could not be completed." };
    revalidatePath("/portal");
    revalidatePath("/titles");
    return { ok: true, message: `Payment received (reference ${reference}). Choose your new title.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Payment could not be completed." };
  }
}
