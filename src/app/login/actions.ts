"use server";

import { redirect } from "next/navigation";

import { usernameToAuthEmail } from "@/lib/auth-credentials";
import { isStaffUser } from "@/lib/auth-staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { ok: false; message: string } | null;

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "").trim();
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (!username || !password) {
    return { ok: false, message: "Username and password are required." };
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { ok: false, message: "Auth is not configured (missing Supabase env)." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToAuthEmail(username),
    password,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!isStaffUser(data.user)) {
    await supabase.auth.signOut();
    return { ok: false, message: "This account does not have staff access." };
  }

  redirect(next);
}
