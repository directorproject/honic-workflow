import Link from "next/link";
import { Suspense } from "react";

import { ExploreFeaturePanel } from "@/components/portal/explore-feature-panel";
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
import { createWorkspaceAction } from "@/app/portal/workspace-actions";
import { findMembership } from "@/lib/workspace/access";
import { defaultEndDate, todayIso } from "@/lib/workspace/dates";
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

/** Desk tools shown in the side nav — free users can open them, but services stay locked. */
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
  let membership = db ? await findMembership(db, user.id) : null;
  const linked = Boolean(profile.trackedProjectId);
  const hasProgress = linked;
  const paid = hasActiveDeskPlan(profile.deskExpiresAt);
  const viewerDetail = [profile.courseOther ?? profile.courseCode, profile.institution, user.email].filter(Boolean).join(" · ");

  const onProjects = tab === "projects" || tab === "title";
  const onPayments = tab === "payments";
  const onAccount = tab === "account";
  const onProgress = tab === "progress";
  const onHome = tab === "home" || !tab;
  const onDeskTool = DESK_EXPLORE_TABS.has(tab);
  const freeExplore = !paid && (onHome || onDeskTool);

  /** Paid plan includes the full desk — open tools immediately without a manual “start workspace” step. */
  if (paid && db && !membership && !onAccount && (onHome || onDeskTool || onProjects || onPayments || onProgress)) {
    const { data: pickedTitle } = await db
      .from("title_proposals")
      .select("title")
      .eq("selected_by", user.id)
      .maybeSingle();
    const firstName = profile.fullName.trim().split(/\s+/)[0] || "My";
    const projectName = String(pickedTitle?.title ?? "").trim() || `${firstName} project`;
    const start = todayIso();
    const created = await createWorkspaceAction({
      name: projectName,
      category: profile.projectCategory ?? "fyp",
      startDate: start,
      endDate: defaultEndDate(start),
      defenceDate: "",
      withPlan: true,
    });
    if (created.ok) {
      membership = await findMembership(db, user.id);
    }
  }

  // Skip the heavy workspace bundle on free explore screens and account-only views.
  const needsBundle = Boolean(membership && db && !freeExplore && !onAccount && (onHome || onDeskTool || onProjects || onPayments || onProgress));
  const bundle = needsBundle && membership && db ? await loadWorkspaceBundle(db, membership.workspaceId) : null;

  const needsProjectsData = onProjects;
  const needsPaymentsData = onPayments;
  const needsChoices = needsProjectsData || (onHome && paid && !bundle);

  const choices = needsChoices && db
    ? await loadTitleChoices(db, user.id, profile)
    : { mine: state.myTitle ? [state.myTitle] : [], available: [] };

  let projectsPanel: React.ReactNode = null;
  if (needsProjectsData) {
    const [claims, catalogue] = await Promise.all([
      db ? claimsForUser(db, user.id) : Promise.resolve([]),
      db ? listOwnershipCatalogue(db) : Promise.resolve([]),
    ]);
    const confirmedTargets = claims
      .filter((c) => c.status === "confirmed" && c.targetKind && c.targetId)
      .map((c) => ({ kind: c.targetKind!, id: c.targetId! }));
    const engagementMap = db && confirmedTargets.length ? await engagementForTargets(db, confirmedTargets) : new Map();
    const engagementByTarget = Object.fromEntries([...engagementMap.entries()].map(([k, v]) => [k, v]));
    for (const t of confirmedTargets) {
      const key = engagementKey(t.kind, t.id);
      if (!engagementByTarget[key]) {
        engagementByTarget[key] = { targetKind: t.kind, targetId: t.id, clickCount: 0, buyCount: 0 };
      }
    }
    const entitlement = titleHideEntitlement({
      deskExpiresAt: profile.deskExpiresAt,
      changeCredits: profile.changeCredits,
      selectedCount: choices.mine.length,
      hiddenCount: choices.mine.filter((t) => t.hiddenFromPeers).length,
    });
    projectsPanel = (
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
  }

  let paymentsPanel: React.ReactNode = null;
  let paymentsLedger:
    | {
        payments: Awaited<ReturnType<typeof listPaymentsForUser>>;
        registeredName: string;
        payoutEligible: boolean;
        payoutAccount: Awaited<ReturnType<typeof loadPayoutAccount>>;
      }
    | undefined;
  if (needsPaymentsData) {
    const [payments, payoutAccount, claims] = await Promise.all([
      db ? listPaymentsForUser(db, user.id).catch(() => []) : Promise.resolve([]),
      db ? loadPayoutAccount(db, user.id).catch(() => null) : Promise.resolve(null),
      db ? claimsForUser(db, user.id) : Promise.resolve([]),
    ]);
    const payoutEligible = claims.some((c) => c.status === "confirmed");
    paymentsLedger = {
      payments,
      registeredName: profile.fullName,
      payoutEligible,
      payoutAccount,
    };
    paymentsPanel = (
      <PaymentsBoard
        payments={payments}
        invoices={bundle?.invoices ?? []}
        registeredName={profile.fullName}
        payoutEligible={payoutEligible}
        payoutAccount={payoutAccount}
        canPayInvoices={Boolean(bundle)}
      />
    );
  }

  const accountPanel = (
    <ProfileForm
      courses={state.courses}
      profile={profile}
      cancelHref="/portal/home"
      suggestedName={user.suggestedName}
      academicStepPending={state.profileAcademicPending}
    />
  );

  let body: React.ReactNode;
  if (onPayments) {
    body = paymentsPanel;
  } else if (onProjects) {
    body = projectsPanel;
  } else if (onAccount) {
    body = accountPanel;
  } else if (freeExplore) {
    body = onHome ? (
      <FreeHomeExplore name={profile.fullName} />
    ) : (
      <ExploreFeaturePanel featureKey={tab} hasPaidPlan={false} hasWorkspace={Boolean(membership)} />
    );
  } else if (bundle) {
    body = (
      <WorkspaceView
        bundle={bundle}
        viewer={{
          kind: "student",
          userId: user.id,
          name: profile.fullName,
          canEdit: true,
          hasPaidDesk: paid,
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
          progress: hasProgress ? (onProgress ? await renderHonicProgress(profile.trackedProjectId!) : <span />) : undefined,
        }}
      />
    );
  } else if (onDeskTool) {
    body = <ExploreFeaturePanel featureKey={tab} hasPaidPlan={paid} hasWorkspace={false} />;
  } else if (onProgress && linked) {
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
        hasWorkspace={Boolean(membership)}
        hasProgress={hasProgress}
        deskExpiresAt={profile.deskExpiresAt}
      >
        {body}
      </PortalShell>
    </Suspense>
  );
}

function FreeHomeExplore({ name }: { name: string }) {
  return (
    <div className="space-y-6">
      <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border">
        <div className="border-dash-border border-b bg-gradient-to-br from-[color-mix(in_oklab,var(--dash-accent)_14%,transparent)] to-transparent px-5 py-6 sm:px-8">
          <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">Welcome</p>
          <h2 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Hi {name.split(" ")[0] || "there"}, explore Honic Nexis
          </h2>
          <p className="text-dash-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
            Every side-nav link is open so you can see what the portal offers. Desk tools unlock with a Nexis Desk plan.
            Literature browse and Jobs listings stay free.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/portal/packs"
              className="bg-dash-accent inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            >
              View plans
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
            { href: "/portal/home?tab=messages", t: "Help desk", d: "Message Honic staff" },
          ].map((card) => (
            <Link key={card.href} href={card.href} className="border-dash-border hover:border-dash-accent/40 rounded-xl border px-4 py-3 transition">
              <p className="text-dash-foreground text-sm font-semibold">{card.t}</p>
              <p className="text-dash-muted-foreground mt-1 text-xs">{card.d}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
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
