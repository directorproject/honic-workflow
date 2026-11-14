"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { isStaffUser } from "@/lib/auth-staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type SupervisorAuthResult = { ok: true; message?: string } | { ok: false; message: string };
export type SupervisorAuthFormState = SupervisorAuthResult | null;

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

async function upsertSupervisorProfile(userId: string, email: string, fullName: string) {
  const db = getSupabaseAdminClient();
  if (!db) return;
  await db.from("portal_supervisor_profiles").upsert(
    {
      user_id: userId,
      email: email.toLowerCase(),
      full_name: fullName || "Supervisor",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function supervisorSignUpAction(fullName: string, email: string, password: string): Promise<SupervisorAuthResult> {
  const name = clean(fullName, 120);
  const e = clean(email, 254).toLowerCase();
  if (!name) return { ok: false, message: "Enter your name." };
  if (!EMAIL_RE.test(e)) return { ok: false, message: "Enter a valid email address." };
  if (String(password).length < 8) return { ok: false, message: "Password must be at least 8 characters." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: e,
    password: String(password),
    options: {
      emailRedirectTo: `${await requestOrigin()}/portal/auth/callback?next=/supervisor`,
      data: { full_name: name, role: "supervisor" },
    },
  });
  if (error) return { ok: false, message: error.message };
  if (data.user?.id) await upsertSupervisorProfile(data.user.id, e, name);
  if (data.session) {
    revalidatePath("/supervisor");
    redirect("/supervisor");
  }
  redirect("/supervisor?auth=signin&notice=check_email");
}

export async function supervisorSignInAction(email: string, password: string): Promise<SupervisorAuthResult> {
  const e = clean(email, 254).toLowerCase();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: e,
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
    return { ok: false, message: "Staff accounts sign in on the staff site." };
  }
  const meta = (data.user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const name = clean(meta.full_name || meta.name, 120) || "Supervisor";
  if (data.user?.id) await upsertSupervisorProfile(data.user.id, e, name);
  revalidatePath("/supervisor");
  redirect("/supervisor");
}

export async function supervisorAuthFormAction(
  _prev: SupervisorAuthFormState,
  formData: FormData,
): Promise<SupervisorAuthFormState> {
  const mode = clean(formData.get("mode"), 16);
  const email = clean(formData.get("email"), 254);
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");
  const fullName = clean(formData.get("fullName"), 120);

  if (mode === "signup") {
    if (password !== password2) return { ok: false, message: "The two passwords do not match." };
    return supervisorSignUpAction(fullName, email, password);
  }
  if (mode === "signin") return supervisorSignInAction(email, password);
  return { ok: false, message: "Unknown sign-in mode." };
}

export async function supervisorSignOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/supervisor");
}
