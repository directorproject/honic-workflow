import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/portal/profile-form";
import { loadPortalState } from "@/lib/portal/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PortalHome } from "../portal-home";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Honic Nexis · Honic Company Limited",
  manifest: "/portal.webmanifest",
  appleWebApp: { capable: true, title: "Honic Nexis", statusBarStyle: "default" as const },
};

export default async function PortalHomePage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = props.searchParams ? await props.searchParams : {};
  const sp = {
    tab: typeof raw.tab === "string" ? raw.tab : undefined,
    edit: typeof raw.edit === "string" ? raw.edit : undefined,
    notice: typeof raw.notice === "string" ? raw.notice : undefined,
  };

  const state = await loadPortalState();
  const { user, profile } = state;
  const tab = sp.tab ?? (sp.edit === "1" ? "account" : "home");

  if (user && state.isStaff) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/portal?auth=signup&notice=student_only");
  }

  if (!user) {
    const q = new URLSearchParams();
    q.set("auth", "signin");
    if (tab && tab !== "home") q.set("next", `/portal/home?tab=${encodeURIComponent(tab)}`);
    redirect(`/portal?${q.toString()}`);
  }

  if (!profile) {
    return (
      <main className="bg-dash-canvas text-dash-foreground mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <ProfileForm
          courses={state.courses}
          profile={null}
          suggestedName={user.suggestedName}
          needsPasswordSetup={user.needsPasswordSetup}
        />
      </main>
    );
  }

  return <PortalHome state={state} tab={tab} notice={sp.notice} />;
}