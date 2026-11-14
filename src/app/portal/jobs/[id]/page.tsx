import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { JobDetailPanel } from "@/components/portal/jobs-board";
import { PortalShell } from "@/components/portal/portal-shell";
import { SiteFooter } from "@/components/portal/site-footer";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
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

  if (!user || !db) {
    return (
      <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
        <div className="border-dash-border sticky top-0 z-30 border-b backdrop-blur-md">
          <CompanyBrandBar variant="full" />
        </div>
        <div className="mx-auto max-w-lg flex-1 px-4 py-10">
          <p className="text-sm">
            <Link href="/portal?auth=signin" className="text-dash-accent font-semibold">
              Sign in
            </Link>{" "}
            to view this job.
          </p>
        </div>
        <SiteFooter />
      </main>
    );
  }

  const viewerId = state.isStaff ? null : user.id;
  const job = await getJobByPublicId(db, id, viewerId);
  if (!job) notFound();

  const applications = job.isMine || state.isStaff ? await listApplicationsForJob(db, job.id, viewerId) : [];
  const myApplication = viewerId && !job.isMine ? await getMyApplicationForJob(db, job.id, viewerId) : null;

  const threadApps = job.isMine
    ? applications.filter((a) => a.status === "pending" || a.status === "accepted")
    : myApplication
      ? [myApplication]
      : [];

  const messagesByApplicationPublicId: Record<string, PortalJobMessage[]> = {};
  for (const app of threadApps) {
    messagesByApplicationPublicId[app.publicId] = await listMessagesForApplication(db, app.id, viewerId);
  }

  const membership = !state.isStaff ? await findMembership(db, user.id) : null;
  const viewerDetail = state.isStaff
    ? "Staff · job detail"
    : [profile?.courseOther ?? profile?.courseCode, studyLevelLabel(profile?.studyLevel ?? null, profile?.studyLevelOther), profile?.institution]
        .filter(Boolean)
        .join(" · ") || user.email;

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        viewer={{ name: profile?.fullName || user.email, detail: viewerDetail }}
        hasWorkspace={Boolean(membership)}
        hasProgress={Boolean(profile?.trackedProjectId)}
        deskExpiresAt={profile?.deskExpiresAt ?? null}
      >
        <JobDetailPanel
          job={job}
          applications={applications}
          myApplication={myApplication}
          messagesByApplicationPublicId={messagesByApplicationPublicId}
          canUseJobs={hasActiveDeskPlan(profile?.deskExpiresAt)}
        />
      </PortalShell>
    </Suspense>
  );
}
