import Link from "next/link";
import { Suspense } from "react";

import { ExploreFeaturePanel, FeaturePreview, featureTitle } from "@/components/portal/explore-feature-panel";
import { PlanLock } from "@/components/portal/plan-lock";
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
      <PlanLock locked title={featureTitle(tab)} body="Free plan can look around. Activate a semester or year Nexis Desk plan to use this tool.">
        <FeaturePreview featureKey={tab} />
      </PlanLock>
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
  const firstName = name.split(" ")[0] || "there";
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="border-dash-border bg-dash-card overflow-hidden rounded-3xl border">
        <div className="relative overflow-hidden">
          {/* Background gradient */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-50"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--dash-accent) 20%, transparent) 0%, color-mix(in oklab, var(--dash-accent) 5%, transparent) 100%)",
            }}
          />
          <div className="relative px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
            <div className="max-w-2xl">
              <p className="text-dash-accent text-sm font-semibold tracking-wide uppercase">Welcome to Honic Nexis</p>
              <h1 className="text-dash-foreground mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Hi {firstName}, ready to start?
              </h1>
              <p className="text-dash-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
                Explore the student portal. Browse project titles, connect with peers through jobs, and unlock full project management with a Nexis Desk plan.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/portal/packs"
                  className="bg-dash-accent text-white hover:bg-dash-accent/90 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition"
                >
                  Explore plans →
                </Link>
                <Link
                  href="/portal/titles"
                  className="border-dash-border hover:border-dash-accent/50 hover:bg-dash-muted/40 text-dash-foreground inline-flex items-center justify-center rounded-xl border px-6 py-3 text-sm font-semibold transition"
                >
                  Browse titles
                </Link>
                <Link
                  href="/portal/jobs"
                  className="border-dash-border hover:border-dash-accent/50 hover:bg-dash-muted/40 text-dash-foreground inline-flex items-center justify-center rounded-xl border px-6 py-3 text-sm font-semibold transition"
                >
                  Peer help jobs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div>
        <h2 className="text-dash-foreground mb-4 text-lg font-semibold sm:text-xl">Explore what's available</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              href: "/portal/titles",
              title: "Literature Review",
              description: "Browse and study project titles",
              icon: "📚",
              tag: "Free",
            },
            {
              href: "/portal/jobs",
              title: "Peer Help Jobs",
              description: "Connect with students for support",
              icon: "🤝",
              tag: "Free",
            },
            {
              href: "/portal/packs",
              title: "Nexis Desk Plans",
              description: "Unlock project workspace & tools",
              icon: "🎯",
              tag: "Paid",
            },
            {
              href: "/portal/home?tab=gantt",
              title: "Project Planning",
              description: "Gantt timeline and milestones",
              icon: "📅",
              tag: "Paid",
            },
            {
              href: "/portal/home?tab=messages",
              title: "Help Desk",
              description: "Chat with Honic support team",
              icon: "💬",
              tag: "Paid",
            },
            {
              href: "/portal/home?tab=team",
              title: "Team Workspace",
              description: "Collaborate with team members",
              icon: "👥",
              tag: "Paid",
            },
          ].map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="border-dash-border hover:border-dash-accent/40 hover:bg-dash-muted/30 group rounded-2xl border px-4 py-5 transition sm:px-5 sm:py-6"
            >
              <div className="flex items-start justify-between">
                <div className="text-2xl sm:text-3xl">{feature.icon}</div>
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    feature.tag === "Free"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-dash-accent/15 text-dash-accent"
                  }`}
                >
                  {feature.tag}
                </span>
              </div>
              <h3 className="text-dash-foreground mt-3 font-semibold group-hover:text-dash-accent transition">
                {feature.title}
              </h3>
              <p className="text-dash-muted-foreground mt-1 text-sm">{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-dash-card border-dash-border rounded-2xl border px-5 py-6 sm:px-8">
        <h2 className="text-dash-foreground mb-4 text-lg font-semibold sm:text-xl">Portal highlights</h2>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[
            { label: "Titles available", value: "500+" },
            { label: "Peer helpers", value: "1000+" },
            { label: "Active projects", value: "250+" },
            { label: "Support ready", value: "24/7" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-dash-accent text-xl sm:text-2xl font-bold">{stat.value}</p>
              <p className="text-dash-muted-foreground text-xs sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-gradient-to-br from-dash-accent/10 to-dash-accent/5 border-dash-border rounded-2xl border px-5 py-6 sm:px-8">
        <h3 className="text-dash-foreground font-semibold">Get started</h3>
        <ul className="text-dash-muted-foreground mt-3 space-y-2 text-sm">
          <li>✓ Browse 500+ project titles free</li>
          <li>✓ Connect with peer helpers for support</li>
          <li>✓ Upgrade anytime for full workspace access</li>
        </ul>
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
