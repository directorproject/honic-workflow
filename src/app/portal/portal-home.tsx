import { Suspense } from "react";

import { MyProjectsPanel } from "@/components/portal/my-projects-panel";
import { PaymentsBoard } from "@/components/portal/payments-board";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { ProjectShareView } from "@/components/share/project-share-view";
import { StartWorkspace } from "@/components/workspace/start-workspace";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import type { PortalState } from "@/lib/portal/data";
import { listPaymentsForUser } from "@/lib/portal/payments-ledger";
import { loadPayoutAccount } from "@/lib/portal/payout-accounts";
import { claimsForUser, listOwnershipCatalogue } from "@/lib/portal/title-claims";
import { engagementForTargets, engagementKey } from "@/lib/portal/title-engagement";
import { loadTitleChoices } from "@/lib/portal/title-choices";
import { hasActiveDeskPlan, titleHideEntitlement } from "@/lib/portal/title-limits";
import { createProjectShareLink } from "@/lib/project-share";
import { loadProjectDetail } from "@/lib/projects-data";
import { shareLinkPathClientSlug } from "@/lib/share-link-origin";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";
import { loadWorkspaceBundle } from "@/lib/workspace/load";

const PROJECT_NOTICES: Record<string, string> = {
  posted: "Your new title was sent for review.",
  claimed: "Your ownership claim was sent for review.",
  appealed: "Your appeal was sent for review. Admin will check your proof before changing ownership.",
  missing: "Type a clearer title (at least 8 characters) for a new project.",
  pick_title: "Search and select a matching title first, or continue as new.",
  answers: "Answer every ownership question.",
  files: "Upload valid project files (PDF, Word, PowerPoint, or image, max 25 MB) and ownership proof if you chose upload.",
  upload: "A file could not be stored. Try again with a smaller file.",
  waiting: "You already have a pending request for this title.",
  yours: "You already own this title.",
  migrate: "Ownership storage is not ready yet. Ask staff to apply the latest database migration.",
  unavailable: "Claims are not ready yet.",
  signin: "Sign in to claim a title.",
};

export async function PortalHome({
  state,
  tab,
  notice,
}: {
  state: PortalState;
  tab: string;
  notice?: string;
}) {
  const { user, profile } = state;
  if (!user || !profile) return null;

  const db = getSupabaseAdminClient();
  const membership = db ? await findMembership(db, user.id) : null;
  const bundle = membership && db ? await loadWorkspaceBundle(db, membership.workspaceId) : null;
  const linked = Boolean(profile.trackedProjectId);
  const hasProgress = linked;
  const viewerDetail = [profile.courseOther ?? profile.courseCode, profile.institution, user.email].filter(Boolean).join(" · ");

  const choices = db ? await loadTitleChoices(db, user.id, profile) : { mine: state.myTitle ? [state.myTitle] : [], available: [] };
  const claims = db ? await claimsForUser(db, user.id) : [];
  const catalogue = db ? await listOwnershipCatalogue(db) : [];
  const confirmedTargets = claims
    .filter((c) => c.status === "confirmed" && c.targetKind && c.targetId)
    .map((c) => ({ kind: c.targetKind!, id: c.targetId! }));
  const engagementMap = db && confirmedTargets.length ? await engagementForTargets(db, confirmedTargets) : new Map();
  const engagementByTarget = Object.fromEntries(
    [...engagementMap.entries()].map(([k, v]) => [k, v]),
  );
  // Ensure confirmed claims without a row still resolve to zeros via key lookup.
  for (const t of confirmedTargets) {
    const key = engagementKey(t.kind, t.id);
    if (!engagementByTarget[key]) {
      engagementByTarget[key] = { targetKind: t.kind, targetId: t.id, clickCount: 0, buyCount: 0 };
    }
  }
  const payments = db ? await listPaymentsForUser(db, user.id).catch(() => []) : [];
  const payoutAccount = db ? await loadPayoutAccount(db, user.id).catch(() => null) : null;
  const payoutEligible = claims.some((c) => c.status === "confirmed");
  const paymentsLedger = {
    payments,
    registeredName: profile.fullName,
    payoutEligible,
    payoutAccount,
  };
  const entitlement = titleHideEntitlement({
    deskExpiresAt: profile.deskExpiresAt,
    changeCredits: profile.changeCredits,
    selectedCount: choices.mine.length,
    hiddenCount: choices.mine.filter((t) => t.hiddenFromPeers).length,
  });
  const paymentsPanel = (
    <PaymentsBoard
      payments={payments}
      invoices={bundle?.invoices ?? []}
      registeredName={profile.fullName}
      payoutEligible={payoutEligible}
      payoutAccount={payoutAccount}
      canPayInvoices={Boolean(bundle)}
    />
  );
  const projectsPanel = (
    <div className="space-y-4">
      {notice && PROJECT_NOTICES[notice] ? (
        <p className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 text-sm">{PROJECT_NOTICES[notice]}</p>
      ) : null}
      <MyProjectsPanel
        selected={choices.mine}
        phone={profile.phone}
        changeCredits={profile.changeCredits}
        projectStarted={linked}
        claims={claims}
        catalogue={catalogue}
        entitlement={entitlement}
        deskExpiresAt={profile.deskExpiresAt}
        deskPlan={profile.deskPlan}
        engagementByTarget={engagementByTarget}
      />
    </div>
  );
  const accountPanel = <ProfileForm courses={state.courses} profile={profile} cancelHref="/portal/home" suggestedName={user.suggestedName} />;

  let body: React.ReactNode;
  if (bundle) {
    body = (
      <WorkspaceView
        bundle={bundle}
        viewer={{
          kind: "student",
          userId: user.id,
          name: profile.fullName,
          canEdit: true,
          hasPaidDesk: hasActiveDeskPlan(profile.deskExpiresAt),
        }}
        tab={tab}
        basePath="/portal/home"
        printBase="/portal/print"
        exportBase="/api/portal/export"
        fileBase="/api/portal/files"
        hideNav
        extra={{
          projects: projectsPanel,
          account: accountPanel,
          title: projectsPanel,
          paymentsLedger,
          progress: hasProgress ? (tab === "progress" ? await renderHonicProgress(profile.trackedProjectId!) : <span />) : undefined,
        }}
      />
    );
  } else if (tab === "payments") {
    body = paymentsPanel;
  } else if (tab === "projects" || tab === "title") {
    body = projectsPanel;
  } else if (tab === "account") {
    body = accountPanel;
  } else if (tab === "progress" && linked) {
    body = await renderHonicProgress(profile.trackedProjectId!);
  } else {
    const invites = db ? await loadInvitesFor(db, user.email) : [];
    body = (
      <div className="space-y-6">
        {linked ? (
          <a href="/portal/home?tab=progress" className="border-dash-border bg-dash-card block rounded-2xl border px-4 py-3 text-sm font-semibold">
            Honic has started your project. See Honic progress →
          </a>
        ) : null}
        <StartWorkspace suggestedName={choices.mine[0]?.title ?? state.myTitle?.title ?? ""} category={profile.projectCategory} invites={invites} />
      </div>
    );
  }

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        viewer={{ name: profile.fullName, detail: viewerDetail }}
        hasWorkspace={Boolean(bundle)}
        hasProgress={hasProgress}
        deskExpiresAt={profile.deskExpiresAt}
      >
        {body}
      </PortalShell>
    </Suspense>
  );
}

async function loadInvitesFor(db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>, email: string) {
  if (!email) return [];
  const { data } = await db
    .from("portal_workspace_invites")
    .select("token, invited_by, portal_workspaces(name)")
    .ilike("email", email)
    .is("accepted_at", null);
  const rows = data ?? [];
  const inviterIds = [...new Set(rows.map((r) => r.invited_by).filter(Boolean))] as string[];
  const { data: names } = inviterIds.length
    ? await db.from("student_profiles").select("user_id, full_name").in("user_id", inviterIds)
    : { data: [] as { user_id: string; full_name: string }[] };
  return rows.map((r) => {
    const ws = (Array.isArray(r.portal_workspaces) ? r.portal_workspaces[0] : r.portal_workspaces) as { name?: string } | null;
    return {
      token: String(r.token),
      projectName: String(ws?.name ?? "A project"),
      invitedBy: String((names ?? []).find((n) => n.user_id === r.invited_by)?.full_name ?? "Your partner"),
    };
  });
}

async function renderHonicProgress(projectId: string) {
  const { project, error } = await loadProjectDetail(projectId, { includeRegisteredClientContact: false });
  if (!project) {
    return <p className="text-dash-muted-foreground text-sm">Your project is not available right now. Please try again later.</p>;
  }
  let link = await createProjectShareLink({ trackedProjectId: project.id });
  if (!link.ok) link = await createProjectShareLink({ trackedProjectId: project.id });
  if (!link.ok) {
    return <p className="text-dash-muted-foreground text-sm">Your project is not available right now. Please try again later.</p>;
  }
  return (
    <ProjectShareView
      project={project}
      error={error}
      slug={shareLinkPathClientSlug(project.registered_clients)}
      token={link.token}
      badge="Honic progress"
    />
  );
}
