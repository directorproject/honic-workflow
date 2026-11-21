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
import { fetchPortalHighlights, formatHighlightCount, type PortalHighlights } from "@/lib/portal/highlights";
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
    if (onHome) {
      const highlights = db
        ? await fetchPortalHighlights(db)
        : { titles: 0, openJobs: 0, titlesProtected: 0, studyGroups: 0 };
      body = <FreeHomeExplore name={profile.fullName} highlights={highlights} />;
    } else {
      body = (
        <PlanLock locked title={featureTitle(tab)} body="Free plan can look around. Activate a semester or year Nexis Desk plan to use this tool.">
          <FeaturePreview featureKey={tab} />
        </PlanLock>
      );
    }
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

const FREE_HOME_HERO =
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1800&q=80";

function FreeHomeExplore({ name, highlights }: { name: string; highlights: PortalHighlights }) {
  const firstName = name.split(" ")[0] || "there";
  const titleCount = formatHighlightCount(highlights.titles);
  const stats = [
    { label: "Titles", value: titleCount },
    { label: "Open jobs", value: formatHighlightCount(highlights.openJobs) },
    { label: "Protected", value: formatHighlightCount(highlights.titlesProtected) },
    { label: "Study groups", value: formatHighlightCount(highlights.studyGroups) },
  ];

  const freeTools = [
    { href: "/portal/titles", title: "Literature review", blurb: `${titleCount} titles you can browse and shortlist.` },
    { href: "/portal/jobs", title: "Peer help", blurb: "See open jobs and how students help each other." },
  ];

  const deskTools = [
    { href: "/portal/packs", title: "Nexis Desk plans", blurb: "Unlock the full workspace for your project cycle." },
    { href: "/portal/home?tab=gantt", title: "Planning & Gantt", blurb: "Timeline, milestones, and week view." },
    { href: "/portal/home?tab=messages", title: "Help desk", blurb: "Chat with Honic on your project." },
    { href: "/portal/home?tab=team", title: "Team workspace", blurb: "Invite partners and share one desk." },
  ];

  return (
    <div className="free-home">
      {/* Modern Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-500 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-cyan-500 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-widest text-blue-300 uppercase">Honic Nexis Platform</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-4 text-lg text-slate-300 sm:text-xl">
              Start free with titles and peer help. Upgrade to Nexis Desk when you need the full project workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/portal/titles"
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg active:scale-95 sm:px-8"
              >
                Browse Titles
              </Link>
              <Link
                href="/portal/packs"
                className="inline-flex items-center justify-center rounded-xl border border-blue-400/50 bg-blue-500/10 px-6 py-3 font-semibold text-blue-200 backdrop-blur transition-all hover:bg-blue-500/20 hover:border-blue-400 active:scale-95 sm:px-8"
              >
                View Plans
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-14 grid grid-cols-2 gap-3 sm:mt-16 sm:gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/5 backdrop-blur p-4 border border-white/10 sm:p-5">
                <p className="text-2xl font-bold text-white sm:text-3xl tabular-nums">{s.value}</p>
                <p className="mt-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Tools Section */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="mb-8 sm:mb-10">
          <p className="text-sm font-semibold tracking-widest text-blue-600 uppercase dark:text-blue-400">Start Free</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Available on free plan
          </h2>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {freeTools.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:shadow-lg hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600 sm:p-8"
            >
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition-colors sm:text-2xl">
                {item.title}
              </h3>
              <p className="mt-2 text-slate-600 dark:text-slate-400 sm:mt-3">
                {item.blurb}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition-transform dark:text-blue-400">
                Get started <span>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Desk Tools Section */}
      <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold tracking-widest text-blue-600 uppercase dark:text-blue-400">Premium Features</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Unlock with Nexis Desk
            </h2>
            <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
              Planning tools, help desk, and team collaboration unlock when you activate a Nexis Desk plan.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {deskTools.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-slate-200 bg-white p-5 transition-all hover:shadow-md hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {item.blurb}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 whitespace-nowrap">
                    Paid
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/portal/packs"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-lg active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:px-8"
            >
              Compare Plans
            </Link>
            <Link
              href="/portal/titles"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 transition-all hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 sm:px-8"
            >
              Continue browsing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Browse <span className="font-semibold text-slate-900 dark:text-white">{titleCount}</span> titles free · explore peer jobs anytime · upgrade when you need the full workspace.
        </p>
      </section>
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
