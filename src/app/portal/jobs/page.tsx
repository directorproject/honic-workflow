import { Suspense } from "react";

import { JobsBrowseBoard } from "@/components/portal/jobs-board";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import { listChatThreads, listOpenJobs } from "@/lib/portal/jobs";
import { loadGuestOpenJobs } from "@/lib/portal/portal-catalogue-cache";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Peer help · Honic Nexis" };

export default async function PortalJobsPage() {
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();
  const guest = !user;

  if (user && !state.isStaff && (!profile || state.profileAcademicPending)) {
    return (
      <ProfileForm
        courses={state.courses}
        profile={profile}
        suggestedName={user.suggestedName}
        academicStepPending={state.profileAcademicPending}
      />
    );
  }

  const [membership, openJobs, chatThreads] = await Promise.all([
    db && user && !state.isStaff ? findMembership(db, user.id) : Promise.resolve(null),
    db
      ? guest || state.isStaff
        ? loadGuestOpenJobs()
        : listOpenJobs(db, user!.id)
      : Promise.resolve([]),
    db && user && !state.isStaff ? listChatThreads(db, user.id) : Promise.resolve([]),
  ]);

  const viewerDetail = guest
    ? "Preview · sign in to apply"
    : state.isStaff
      ? "Staff · jobs overview"
      : [profile?.courseOther ?? profile?.courseCode, studyLevelLabel(profile?.studyLevel ?? null, profile?.studyLevelOther), profile?.institution]
          .filter(Boolean)
          .join(" · ") || user!.email;

  const canUseJobs = !guest && hasActiveDeskPlan(profile?.deskExpiresAt);
  const needsPolicy = !guest && !state.isStaff && !state.peerHelpAccepted;

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        guest={guest}
        forceGuide={!guest && !state.isStaff && state.productGuideNeeded}
        viewer={{ name: guest ? "Guest" : profile?.fullName || user!.email, detail: viewerDetail }}
        hasWorkspace={Boolean(membership)}
        hasProgress={Boolean(profile?.trackedProjectId)}
        deskExpiresAt={profile?.deskExpiresAt ?? null}
        deskPlan={profile?.deskPlan ?? null}
      >
        <JobsBrowseBoard
          openJobs={openJobs}
          canUseJobs={canUseJobs}
          guest={guest}
          needsPolicy={needsPolicy}
          threads={chatThreads}
        />
      </PortalShell>
    </Suspense>
  );
}
