import { Suspense } from "react";
import Link from "next/link";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { JobsBrowseBoard } from "@/components/portal/jobs-board";
import { PortalAuth } from "@/components/portal/portal-auth";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { SiteFooter } from "@/components/portal/site-footer";
import { studyLevelLabel } from "@/lib/portal/config";
import { isPortalGoogleSignInEnabled } from "@/lib/portal/google-signin";
import { loadPortalState } from "@/lib/portal/data";

import { listOpenJobs } from "@/lib/portal/jobs";

import { hasActiveDeskPlan } from "@/lib/portal/title-limits";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "My jobs · Honic Nexis" };

export default async function PortalJobsPage() {
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();

  if (!user) {
    return (
      <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
        <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
          <CompanyBrandBar variant="full" />
        </div>
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
          <p className="text-dash-muted-foreground mb-4 text-sm">Sign in to view jobs. Applying needs a paid plan.</p>
          <PortalAuth initialStatus={null} googleEnabled={isPortalGoogleSignInEnabled()} />
          <p className="text-dash-muted-foreground mt-6 text-center text-xs">
            <Link href="/portal/titles" className="text-dash-accent font-semibold">
              Browse literature →
            </Link>
          </p>
        </div>
        <SiteFooter />
      </main>
    );
  }

  if (!state.isStaff && !profile) {
    return (
      <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
        <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
          <CompanyBrandBar variant="full" />
        </div>
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
          <ProfileForm courses={state.courses} profile={profile} suggestedName={user.suggestedName} />
        </div>
        <SiteFooter />
      </main>
    );
  }

  const membership = db && !state.isStaff ? await findMembership(db, user.id) : null;
  const viewerDetail = state.isStaff
    ? "Staff · jobs overview"
    : [profile?.courseOther ?? profile?.courseCode, studyLevelLabel(profile?.studyLevel ?? null, profile?.studyLevelOther), profile?.institution]
        .filter(Boolean)
        .join(" · ") || user.email;

  const viewerId = state.isStaff ? null : user.id;
  const openJobs = db ? await listOpenJobs(db, viewerId) : [];

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        viewer={{ name: profile?.fullName || user.email, detail: viewerDetail }}
        hasWorkspace={Boolean(membership)}
        hasProgress={Boolean(profile?.trackedProjectId)}
        deskExpiresAt={profile?.deskExpiresAt ?? null}
      >
        <JobsBrowseBoard openJobs={openJobs} canUseJobs={hasActiveDeskPlan(profile?.deskExpiresAt)} />
      </PortalShell>
    </Suspense>
  );
}
