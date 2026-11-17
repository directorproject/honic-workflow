import { Suspense } from "react";
import Link from "next/link";

import { ExploreFeaturePanel } from "@/components/portal/explore-feature-panel";
import { MyJobsBoard } from "@/components/portal/jobs-board";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import { listMyApplications, listMyJobs } from "@/lib/portal/jobs";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Manage my jobs · Honic Nexis" };

export default async function PortalMyJobsPage() {
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();
  const guest = !user;

  if (user && !state.isStaff && !profile) {
    return (
      <main className="bg-dash-canvas text-dash-foreground mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <ProfileForm
          courses={state.courses}
          profile={profile}
          suggestedName={user.suggestedName}
          needsPasswordSetup={user.needsPasswordSetup}
        />
      </main>
    );
  }

  if (guest) {
    return (
      <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
        <PortalShell
          guest
          viewer={{ name: "Guest", detail: "Preview · sign in to post or manage jobs" }}
          hasWorkspace={false}
          hasProgress={false}
          deskExpiresAt={null}
        >
          <div className="mx-auto max-w-5xl space-y-6 pb-10">
            <header>
              <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">Honic Nexis</p>
              <h1 className="text-dash-foreground mt-1 text-3xl font-semibold tracking-tight">Manage my jobs</h1>
              <p className="text-dash-muted-foreground mt-1 text-sm">
                Post campus and project jobs, review applicants, and message people who apply.
              </p>
            </header>
            <ExploreFeaturePanel featureKey="messages" hasPaidPlan={false} hasWorkspace={false} needsSignIn />
            <p className="text-dash-muted-foreground text-center text-xs">
              <Link href="/portal/jobs" className="text-dash-accent font-semibold">
                Browse open jobs without signing in →
              </Link>
            </p>
          </div>
        </PortalShell>
      </Suspense>
    );
  }

  const membership = db && !state.isStaff ? await findMembership(db, user.id) : null;
  const viewerDetail = state.isStaff
    ? "Staff · jobs overview"
    : [profile?.courseOther ?? profile?.courseCode, studyLevelLabel(profile?.studyLevel ?? null, profile?.studyLevelOther), profile?.institution]
        .filter(Boolean)
        .join(" · ") || user.email;

  const [myJobs, myApplications] =
    db && !state.isStaff
      ? await Promise.all([listMyJobs(db, user.id), listMyApplications(db, user.id)])
      : [[], []];

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        viewer={{ name: profile?.fullName || user.email, detail: viewerDetail }}
        hasWorkspace={Boolean(membership)}
        hasProgress={Boolean(profile?.trackedProjectId)}
        deskExpiresAt={profile?.deskExpiresAt ?? null}
      >
        <MyJobsBoard
          myJobs={myJobs}
          myApplications={myApplications}
          canUseJobs={hasActiveDeskPlan(profile?.deskExpiresAt)}
        />
      </PortalShell>
    </Suspense>
  );
}
