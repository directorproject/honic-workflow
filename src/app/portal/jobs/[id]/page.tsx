import { Suspense } from "react";
import { notFound } from "next/navigation";

import { JobDetailPanel } from "@/components/portal/jobs-board";
import { PortalShell } from "@/components/portal/portal-shell";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import {
  getEscrowForJob,
  getEscrowForJobStaff,
  listDeliverablesForEscrow,
  loadPeerPayoutAccount,
  maybeAutoReleaseEscrowsForJob,
} from "@/lib/portal/job-escrow";
import {
  getJobByPublicId,
  getMyApplicationForJob,
  listApplicationsForJob,
  listMessagesForApplication,
  type PortalJobMessage,
} from "@/lib/portal/jobs";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PortalJobDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();
  const guest = !user;

  if (!db) notFound();

  const viewerId = guest || state.isStaff ? null : user!.id;
  const job = await getJobByPublicId(db, id, viewerId);
  if (!job) notFound();

  if (!guest) await maybeAutoReleaseEscrowsForJob(db, job.id);

  const applications = !guest && (job.isMine || state.isStaff) ? await listApplicationsForJob(db, job.id, viewerId) : [];
  const myApplication = !guest && viewerId && !job.isMine ? await getMyApplicationForJob(db, job.id, viewerId) : null;

  const threadApps = job.isMine
    ? applications.filter((a) => a.status === "pending" || a.status === "accepted")
    : myApplication
      ? [myApplication]
      : [];

  const messagesByApplicationPublicId: Record<string, PortalJobMessage[]> = {};
  for (const app of threadApps) {
    messagesByApplicationPublicId[app.publicId] = await listMessagesForApplication(db, app.id, viewerId);
  }

  let escrow = !guest && viewerId ? await getEscrowForJob(db, job.id, viewerId) : null;
  if (!escrow && state.isStaff) escrow = await getEscrowForJobStaff(db, job.id);
  const deliverables = escrow ? await listDeliverablesForEscrow(db, escrow.id) : [];
  const peerPayout =
    !guest && viewerId && escrow?.isHelper ? await loadPeerPayoutAccount(db, viewerId) : null;

  const membership = !guest && !state.isStaff && user ? await findMembership(db, user.id) : null;
  const viewerDetail = guest
    ? "Preview · sign in to apply"
    : state.isStaff
      ? "Staff · job detail"
      : [profile?.courseOther ?? profile?.courseCode, studyLevelLabel(profile?.studyLevel ?? null, profile?.studyLevelOther), profile?.institution]
          .filter(Boolean)
          .join(" · ") || user!.email;

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        guest={guest}
        viewer={{ name: guest ? "Guest" : profile?.fullName || user!.email, detail: viewerDetail }}
        hasWorkspace={Boolean(membership)}
        hasProgress={Boolean(profile?.trackedProjectId)}
        deskExpiresAt={profile?.deskExpiresAt ?? null}
      >
        <JobDetailPanel
          job={job}
          applications={applications}
          myApplication={myApplication}
          messagesByApplicationPublicId={messagesByApplicationPublicId}
          canUseJobs={!guest && hasActiveDeskPlan(profile?.deskExpiresAt)}
          needsPolicy={Boolean(user) && !state.isStaff && !state.peerHelpAccepted}
          escrow={escrow}
          deliverables={deliverables}
          peerPayoutSaved={Boolean(peerPayout?.sealOk && peerPayout.status === "active")}
          isStaff={state.isStaff}
        />
      </PortalShell>
    </Suspense>
  );
}
