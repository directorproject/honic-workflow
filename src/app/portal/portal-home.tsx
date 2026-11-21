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
    <div className="free-home -mx-3 -mt-4 sm:-mx-6 sm:-mt-5 lg:-mx-8">
      {/* One-composition hero */}
      <section className="relative overflow-hidden bg-slate-950">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-[center_40%] opacity-45"
          style={{ backgroundImage: `url(${FREE_HOME_HERO})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.72) 48%, rgba(2,6,23,0.55) 100%), radial-gradient(50% 60% at 90% 20%, rgba(34,211,238,0.22), transparent 60%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[52vh] max-w-6xl flex-col justify-end px-4 pb-10 pt-14 sm:min-h-[48vh] sm:px-8 sm:pb-14 sm:pt-20">
          <p className="packs-fade text-[10px] font-semibold tracking-[0.28em] text-cyan-200/90 uppercase sm:text-[11px]">
            Honic Nexis
          </p>
          <h1 className="packs-fade packs-fade-delay-1 mt-3 max-w-[12ch] text-[2.55rem] leading-[0.95] font-semibold tracking-tight text-white sm:max-w-xl sm:text-5xl lg:text-6xl">
            Hi {firstName}.
          </h1>
          <p className="packs-fade packs-fade-delay-2 mt-4 max-w-md text-[13px] leading-relaxed text-white/70 sm:text-base">
            Start free with titles and peer help. Add a Desk plan when you need the full project workspace.
          </p>
          <div className="packs-fade packs-fade-delay-3 mt-7 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:items-center">
            <Link
              href="/portal/titles"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-900 transition hover:bg-cyan-50 active:scale-[0.99] sm:rounded-full sm:py-2.5"
            >
              Browse titles
            </Link>
            <Link
              href="/portal/packs"
              className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10 active:scale-[0.99] sm:rounded-full sm:py-2.5"
            >
              View plans
            </Link>
          </div>
        </div>

        {/* Live highlights strip — part of hero composition */}
        <div className="relative border-t border-white/10 bg-black/25 backdrop-blur-md">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="px-4 py-4 sm:px-6 sm:py-5">
                <p className="text-xl font-semibold tracking-tight text-white tabular-nums sm:text-2xl">{s.value}</p>
                <p className="mt-0.5 text-[11px] font-medium tracking-wide text-white/50 uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free tools — large editorial rows */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex items-end justify-between gap-4 border-b border-dash-border pb-4">
          <div>
            <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">Open now</p>
            <h2 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">On the free plan</h2>
          </div>
          <p className="text-dash-muted-foreground hidden text-right text-xs sm:block">
            No payment needed
          </p>
        </div>
        <ul className="divide-dash-border divide-y">
          {freeTools.map((item, i) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-baseline gap-4 py-6 transition sm:gap-8 sm:py-7"
              >
                <span className="text-dash-muted-foreground w-8 shrink-0 font-mono text-sm tabular-nums">
                  0{i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-dash-foreground text-lg font-semibold tracking-tight transition group-hover:text-dash-accent sm:text-xl">
                    {item.title}
                  </h3>
                  <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed">{item.blurb}</p>
                </div>
                <span className="text-dash-muted-foreground group-hover:text-dash-accent shrink-0 text-sm font-semibold transition">
                  Open →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Desk tools — dense modern list, monochrome tags */}
      <section className="border-dash-border bg-dash-card/60 border-y">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
          <div className="max-w-xl">
            <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">With a desk plan</p>
            <h2 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Full project workspace
            </h2>
            <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">
              Planning, help desk, and team tools unlock when your Nexis Desk plan is active.
            </p>
          </div>
          <div className="mt-8 grid gap-0 sm:grid-cols-2 sm:gap-x-10">
            {deskTools.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-dash-border group flex items-start justify-between gap-4 border-t py-5 transition first:border-t-0 sm:py-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-dash-foreground text-base font-semibold tracking-tight group-hover:underline">
                      {item.title}
                    </h3>
                    <span className="border-dash-border text-dash-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                      Paid
                    </span>
                  </div>
                  <p className="text-dash-muted-foreground mt-1.5 text-sm leading-relaxed">{item.blurb}</p>
                </div>
                <span className="text-dash-muted-foreground mt-1 shrink-0 text-sm" aria-hidden>
                  →
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/portal/packs"
              className="bg-dash-foreground text-dash-canvas hover:opacity-90 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold transition sm:w-auto sm:rounded-full"
            >
              Compare Desk plans →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-12">
        <p className="text-dash-muted-foreground text-sm leading-relaxed">
          Browse <span className="text-dash-foreground font-medium tabular-nums">{titleCount}</span> titles free · open peer
          jobs anytime · upgrade when you need the desk.
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
