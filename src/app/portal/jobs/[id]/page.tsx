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
  listEscrowEvents,
  loadPeerPayoutAccount,
  maybeAutoReleaseEscrowsForJob,
} from "@/lib/portal/job-escrow";
import {
  getJobByPublicId,
  getMyApplicationForJob,
  listApplicationsForJob,
  listChatThreads,
  listMessagesForApplication,
  type PortalJobMessage,
} from "@/lib/portal/jobs";
import { loadPayoutAccount } from "@/lib/portal/payout-accounts";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PortalJobDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chat?: string | string[] }>;
}) {
  const { id } = await props.params;
  const { chat } = await props.searchParams;
  const initialChat = typeof chat === "string" && chat ? chat : null;
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();
  const guest = !user;

  if (!db) notFound();

  const viewerId = guest ? null : user!.id;
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
  const [threadMessages, threads] = await Promise.all([
    Promise.all(threadApps.map((app) => listMessagesForApplication(db, app.id, viewerId))),
    job.isMine && viewerId ? listChatThreads(db, viewerId, { jobId: job.id }) : Promise.resolve([]),
  ]);
  threadApps.forEach((app, i) => {
    messagesByApplicationPublicId[app.publicId] = threadMessages[i];
  });

  let escrow = !guest && viewerId ? await getEscrowForJob(db, job.id, viewerId) : null;
  if (!escrow && state.isStaff) escrow = await getEscrowForJobStaff(db, job.id);
  const deliverables = escrow ? await listDeliverablesForEscrow(db, escrow.id) : [];
  const events = escrow ? await listEscrowEvents(db, escrow.id) : [];
  const peerPayout =
    !guest && viewerId && escrow?.isHelper ? await loadPeerPayoutAccount(db, viewerId) : null;
  const peerPayoutSaved = Boolean(peerPayout?.sealOk && peerPayout.status === "active");
  // Picked helper without a peer-help number: offer their saved payout account (masked).
  const savedAccount =
    viewerId && escrow?.isHelper && !peerPayoutSaved ? await loadPayoutAccount(db, viewerId) : null;
  const savedPayout =
    savedAccount?.sealOk && savedAccount.status === "active"
      ? { network: savedAccount.network, phoneTail: savedAccount.phone.replace(/\D/g, "").slice(-3) }
      : null;

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
          canUseJobs={
            !guest && (state.isStaff || hasActiveDeskPlan(profile?.deskExpiresAt) || job.isMine)
          }
          needsPolicy={Boolean(user) && !state.isStaff && !state.peerHelpAccepted}
          escrow={escrow}
          deliverables={deliverables}
          events={events}
          peerPayoutSaved={peerPayoutSaved}
          savedPayout={savedPayout}
          isStaff={state.isStaff}
          threads={threads}
          initialChat={initialChat}
        />
      </PortalShell>
    </Suspense>
  );
}
