import { Suspense } from "react";

import { JobsBrowseBoard } from "@/components/portal/jobs-board";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import { listOpenJobs } from "@/lib/portal/jobs";
import { loadGuestOpenJobs } from "@/lib/portal/portal-catalogue-cache";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Posted jobs · Honic Nexis" };

export default async function PortalJobsPage() {
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

  const [membership, openJobs] = await Promise.all([
    db && user && !state.isStaff ? findMembership(db, user.id) : Promise.resolve(null),
    db
      ? guest || state.isStaff
        ? loadGuestOpenJobs()
        : listOpenJobs(db, user!.id)
      : Promise.resolve([]),
  ]);

  const viewerDetail = guest
    ? "Preview · sign in to apply"
    : state.isStaff
      ? "Staff · jobs overview"
      : [profile?.courseOther ?? profile?.courseCode, studyLevelLabel(profile?.studyLevel ?? null, profile?.studyLevelOther), profile?.institution]
          .filter(Boolean)
          .join(" · ") || user!.email;

  const canUseJobs = !guest && hasActiveDeskPlan(profile?.deskExpiresAt);

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        guest={guest}
        viewer={{ name: guest ? "Guest" : profile?.fullName || user!.email, detail: viewerDetail }}
        hasWorkspace={Boolean(membership)}
        hasProgress={Boolean(profile?.trackedProjectId)}
        deskExpiresAt={profile?.deskExpiresAt ?? null}
      >
        <JobsBrowseBoard openJobs={openJobs} canUseJobs={canUseJobs} guest={guest} />
      </PortalShell>
    </Suspense>
  );
}
