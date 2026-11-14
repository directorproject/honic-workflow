import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { PortalAuth } from "@/components/portal/portal-auth";
import { SiteFooter } from "@/components/portal/site-footer";
import { loadPortalState } from "@/lib/portal/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Honic Nexis · Honic Company Limited",
  manifest: "/portal.webmanifest",
  appleWebApp: { capable: true, title: "Honic portal", statusBarStyle: "default" as const },
};

const AUTH_NOTICES: Record<string, { ok: boolean; message: string }> = {
  confirmed: { ok: true, message: "Your email is confirmed. Sign in to continue." },
  check_email: {
    ok: true,
    message: "Check your inbox for a confirmation link, then sign in here.",
  },
  reset_other_device: {
    ok: false,
    message: "Open the password reset link on the same phone or computer where you asked for it, or request a new link.",
  },
  student_only: {
    ok: true,
    message: "This portal is for students and supervisors. Create an account (or sign in). Staff use inova.",
  },
};

export default async function PortalAuthPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = props.searchParams ? await props.searchParams : {};
  const sp = {
    tab: typeof raw.tab === "string" ? raw.tab : undefined,
    edit: typeof raw.edit === "string" ? raw.edit : undefined,
    auth: typeof raw.auth === "string" ? raw.auth : undefined,
    role: typeof raw.role === "string" ? raw.role : undefined,
    auth_error: typeof raw.auth_error === "string" ? raw.auth_error : undefined,
    notice: typeof raw.notice === "string" ? raw.notice : undefined,
  };

  // Never allow passwords in the URL (old GET form leak / shared links).
  if ("password" in raw || "password2" in raw) {
    const q = new URLSearchParams();
    if (sp.auth === "signin" || sp.auth === "signup" || sp.auth === "forgot") q.set("auth", sp.auth);
    q.set("notice", "creds_in_url");
    redirect(`/portal?${q.toString()}`);
  }

  const state = await loadPortalState();
  const { user } = state;

  // Staff session cannot use the student portal — clear it and show the student form.
  if (user && state.isStaff) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/portal?auth=signup&notice=student_only");
  }

  // Logged-in students use the session app (keeps this page's client graph auth-only).
  if (user) {
    const q = new URLSearchParams();
    if (sp.tab) q.set("tab", sp.tab);
    if (sp.edit) q.set("edit", sp.edit);
    if (sp.notice) q.set("notice", sp.notice);
    const qs = q.toString();
    redirect(qs ? `/portal/home?${qs}` : "/portal/home");
  }

  const notices: Record<string, { ok: boolean; message: string }> = {
    ...AUTH_NOTICES,
    creds_in_url: {
      ok: false,
      message:
        "Your password was put in the browser address bar. That is unsafe. Change this password if it was a real account, then sign in again on this form.",
    },
  };
  const initial = sp.notice && notices[sp.notice]
    ? notices[sp.notice]
    : sp.auth_error
      ? { ok: false, message: "That link is invalid or has expired. Please try again." }
      : null;
  const authMode = sp.auth === "signin" || sp.auth === "forgot" ? sp.auth : sp.notice === "confirmed" ? "signin" : "signup";
  const initialRole = sp.role === "supervisor" ? "supervisor" : "student";

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-5xl">
        <PortalAuth
          key={`${authMode}-${initialRole}-${sp.notice ?? ""}-${sp.auth_error ?? ""}`}
          initialStatus={initial}
          initialMode={authMode}
          initialRole={initialRole}
          googleEnabled={process.env.PORTAL_GOOGLE_SIGNIN === "true"}
        />
      </div>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% -10%, rgba(14, 165, 180, 0.18), transparent 55%), radial-gradient(900px 500px at 90% 10%, rgba(15, 23, 42, 0.08), transparent 50%), linear-gradient(180deg, #f4f7f9 0%, #e8eef2 100%)",
        }}
      />
      <div className="border-dash-border bg-dash-canvas/80 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</div>
      <SiteFooter />
    </main>
  );
}
