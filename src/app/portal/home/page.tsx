import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ExploreFeaturePanel } from "@/components/portal/explore-feature-panel";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { loadPortalState } from "@/lib/portal/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { PortalHome } from "../portal-home";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Honic Nexis · Honic Company Limited",
  manifest: "/portal.webmanifest",
  appleWebApp: { capable: true, title: "Honic portal", statusBarStyle: "default" as const },
};

const DESK_EXPLORE_TABS = new Set([
  "gantt",
  "calendar",
  "field",
  "review",
  "documents",
  "corrections",
  "files",
  "team",
  "messages",
  "progress",
  "tasks",
  "logbook",
  "data",
  "references",
]);

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
    return <GuestPortalBrowse tab={tab} />;
  }

  if (!profile) {
    return (
      <main className="bg-dash-canvas text-dash-foreground mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <ProfileForm courses={state.courses} profile={null} suggestedName={user.suggestedName} />
      </main>
    );
  }

  return <PortalHome state={state} tab={tab} notice={sp.notice} />;
}

function GuestPortalBrowse({ tab }: { tab: string }) {
  const onDeskTool = DESK_EXPLORE_TABS.has(tab);
  const onProjects = tab === "projects" || tab === "title";
  const onPayments = tab === "payments";
  const onAccount = tab === "account";

  let body: React.ReactNode;
  if (onAccount || onProjects || onPayments) {
    body = (
      <ExploreFeaturePanel
        featureKey={onPayments ? "messages" : onProjects ? "home" : "home"}
        hasPaidPlan={false}
        hasWorkspace={false}
        needsSignIn
      />
    );
  } else if (onDeskTool) {
    body = <ExploreFeaturePanel featureKey={tab} hasPaidPlan={false} hasWorkspace={false} needsSignIn />;
  } else {
    body = (
      <div className="space-y-6">
        <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border">
          <div className="border-dash-border border-b bg-gradient-to-br from-[color-mix(in_oklab,var(--dash-accent)_14%,transparent)] to-transparent px-5 py-6 sm:px-8">
            <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">Welcome</p>
            <h2 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Explore Honic Nexis
            </h2>
            <p className="text-dash-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
              Open every side-nav page to see what the portal is for. Preview is free — sign in when you want to shortlist
              titles, apply for jobs, or use Desk tools.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/portal?auth=signup"
                className="bg-dash-accent inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              >
                Create account
              </Link>
              <Link
                href="/portal/titles"
                className="border-dash-border text-dash-foreground inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold"
              >
                Browse literature
              </Link>
              <Link href="/portal/jobs" className="text-dash-accent inline-flex items-center text-sm font-semibold">
                Browse jobs →
              </Link>
            </div>
          </div>
          <div className="grid gap-3 px-5 py-5 sm:grid-cols-3 sm:px-8">
            {[
              { href: "/portal/home?tab=gantt", t: "Gantt & plan", d: "Timeline and milestones" },
              { href: "/portal/home?tab=review", t: "Review docs", d: "Drafts and corrections" },
              { href: "/portal/packs", t: "Plans", d: "See Nexis Desk options" },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="border-dash-border hover:border-dash-accent/40 rounded-xl border px-4 py-3 transition"
              >
                <p className="text-dash-foreground text-sm font-semibold">{card.t}</p>
                <p className="text-dash-muted-foreground mt-1 text-xs">{card.d}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        guest
        viewer={{ name: "Guest", detail: "Preview · sign in to use services" }}
        hasWorkspace={false}
        hasProgress={false}
        deskExpiresAt={null}
      >
        {body}
      </PortalShell>
    </Suspense>
  );
}
