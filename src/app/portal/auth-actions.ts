"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { isStaffUser } from "@/lib/auth-staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PortalResult = { ok: true; message?: string } | { ok: false; message: string };
export type PortalAuthFormState = PortalResult | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  const local =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

function clean(v: unknown, max = 200): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function portalSignUpAction(email: string, password: string): Promise<PortalResult> {
  const e = clean(email, 254).toLowerCase();
  if (!EMAIL_RE.test(e)) return { ok: false, message: "Enter a valid email address." };
  if (String(password).length < 8) return { ok: false, message: "Password must be at least 8 characters." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: e,
    password: String(password),
    options: { emailRedirectTo: `${await requestOrigin()}/portal/auth/callback?next=/portal/packs` },
  });
  if (error) return { ok: false, message: error.message };
  if (data.user?.id) {
    try {
      const { ensurePortalAccount } = await import("@/lib/portal/accounts");
      const { getSupabaseServiceRoleClient } = await import("@/lib/supabase-server");
      const admin = getSupabaseServiceRoleClient();
      if (admin) await ensurePortalAccount(admin, data.user.id);
    } catch {
      /* account row is created on first staff list / open */
    }
  }
  if (data.session) {
    revalidatePath("/portal");
    revalidatePath("/portal/home");
    revalidatePath("/portal/packs");
    redirect("/portal/packs");
  }
  // Bounce to sign-in so the confirmation message is visible without client JS.
  redirect("/portal?auth=signin&notice=check_email");
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
  try {
    const { getSupabaseAdminClient } = await import("@/lib/supabase-server");
    const admin = getSupabaseAdminClient();
    if (admin && data.user?.id) {
      const [{ data: mem }, { data: sup }, { data: profile }] = await Promise.all([
        admin.from("portal_workspace_members").select("workspace_id").eq("user_id", data.user.id).maybeSingle(),
        admin.from("portal_supervisor_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle(),
        admin.from("student_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle(),
      ]);
      if (sup && !mem) {
        revalidatePath("/supervisor");
        redirect("/supervisor");
      }
      // New student accounts (no profile yet) land on plans first.
      if (!profile) {
        revalidatePath("/portal");
        revalidatePath("/portal/packs");
        redirect("/portal/packs");
      }
    }
  } catch {
    /* fall through to student home */
  }
  revalidatePath("/portal");
  revalidatePath("/portal/home");
  redirect("/portal/home");
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

/** Form action for student auth. Never puts credentials in the URL. */
export async function portalAuthFormAction(
  _prev: PortalAuthFormState,
  formData: FormData,
): Promise<PortalAuthFormState> {
  const mode = clean(formData.get("mode"), 16);
  const email = clean(formData.get("email"), 254);
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");

  if (mode === "forgot") return portalForgotPasswordAction(email);
  if (mode === "signup") {
    if (password !== password2) return { ok: false, message: "The two passwords do not match." };
    return portalSignUpAction(email, password);
  }
  if (mode === "signin") return portalSignInAction(email, password);
  return { ok: false, message: "Unknown sign-in mode." };
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

export async function portalUpdatePasswordAction(password: string): Promise<PortalResult> {
  if (String(password).length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: String(password) });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Password updated." };
}
