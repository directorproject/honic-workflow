import Link from "next/link";

const FEATURES: Record<
  string,
  { title: string; blurb: string; bullets: string[]; needsPlan?: boolean; needsWorkspace?: boolean }
> = {
  home: {
    title: "Your project home",
    blurb: "A live dashboard for progress, deadlines and what to do next.",
    bullets: ["Status at a glance", "This week’s focus", "Quick links into plan and review"],
    needsWorkspace: true,
  },
  gantt: {
    title: "Gantt chart",
    blurb: "See your whole project on a timeline — phases, tasks and milestones.",
    bullets: ["Ready-made plans by project type", "Drag dates and track slip", "Print for department review"],
    needsPlan: true,
    needsWorkspace: true,
  },
  calendar: {
    title: "Calendar",
    blurb: "Deadlines and field days in one place so nothing sneaks up on you.",
    bullets: ["Milestones and task due dates", "Field study windows", "Share with your supervisor"],
    needsPlan: true,
    needsWorkspace: true,
  },
  field: {
    title: "Field study",
    blurb: "Plan site visits, record notes and keep evidence with the project.",
    bullets: ["Visit schedule", "Notes and photos", "Link findings to tasks"],
    needsPlan: true,
    needsWorkspace: true,
  },
  review: {
    title: "Review documents",
    blurb: "Chapter drafts, corrections and supervisor feedback in one workspace.",
    bullets: ["Shared review docs", "Correction loops", "Supervisor visibility"],
    needsPlan: true,
    needsWorkspace: true,
  },
  files: {
    title: "Project files",
    blurb: "Store reports, drawings and evidence with clear ownership for the team.",
    bullets: ["Organised project storage", "Partner access", "Larger quota on Nexis Desk"],
    needsPlan: true,
    needsWorkspace: true,
  },
  team: {
    title: "Team & supervisor",
    blurb: "Invite partners and list your supervisor so everyone shares one project view.",
    bullets: ["Partner invites", "Supervisor email link", "Shared workspace access"],
    needsPlan: true,
    needsWorkspace: true,
  },
  messages: {
    title: "Help desk",
    blurb: "Message Honic staff about titles, plans, fabrication and project blockers.",
    bullets: ["Direct staff channel", "Project context attached", "Faster answers than email"],
    needsPlan: true,
  },
  progress: {
    title: "Honic progress",
    blurb: "When Honic is delivering your project, track fabrication and milestones here.",
    bullets: ["Live Honic updates", "Shareable client view", "Clear next steps"],
    needsPlan: true,
  },
  tasks: {
    title: "Task board",
    blurb: "Break the plan into tasks you can move from todo to done.",
    bullets: ["Phase-based tasks", "Owner and due dates", "Board for the team"],
    needsPlan: true,
    needsWorkspace: true,
  },
};

/** Preview wall so guests / free users can explore portal features before signing in or upgrading. */
export function ExploreFeaturePanel({
  featureKey,
  hasPaidPlan,
  hasWorkspace,
  needsSignIn = false,
}: {
  featureKey: string;
  hasPaidPlan: boolean;
  hasWorkspace: boolean;
  needsSignIn?: boolean;
}) {
  const feature = FEATURES[featureKey] ?? {
    title: "Nexis Desk feature",
    blurb: "This tool unlocks with an active Nexis Desk plan.",
    bullets: ["Full project workspace", "Help desk", "Jobs post and apply"],
    needsPlan: true,
  };

  const blockedByPlan = !needsSignIn && feature.needsPlan && !hasPaidPlan;
  /** Paid Nexis Desk opens real workspace tools; do not show the extra “start workspace” wall. */
  const blockedByWorkspace = !needsSignIn && Boolean(feature.needsWorkspace && !hasPaidPlan && !hasWorkspace);

  return (
    <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border">
      <div className="border-dash-border border-b bg-gradient-to-br from-[color-mix(in_oklab,var(--dash-accent)_14%,transparent)] to-transparent px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">Explore Nexis</p>
        <h2 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{feature.title}</h2>
        <p className="text-dash-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">{feature.blurb}</p>
      </div>
      <div className="grid gap-6 px-5 py-6 sm:grid-cols-[1.2fr_0.8fr] sm:px-8 sm:py-8">
        <ul className="space-y-3">
          {feature.bullets.map((b) => (
            <li key={b} className="text-dash-foreground flex gap-3 text-sm leading-relaxed">
              <span className="bg-dash-accent mt-1.5 h-2 w-2 shrink-0 rounded-full" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="border-dash-border bg-dash-canvas/60 rounded-xl border px-4 py-4">
          {needsSignIn ? (
            <>
              <p className="text-dash-foreground text-sm font-semibold">See what this is for</p>
              <p className="text-dash-muted-foreground mt-1.5 text-xs leading-relaxed">
                You can browse this screen without an account. Sign in to use {feature.title.toLowerCase()}.
              </p>
              <Link
                href="/portal?auth=signin"
                className="bg-dash-accent mt-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              >
                Sign in to use
              </Link>
              <Link href="/portal?auth=signup" className="text-dash-accent mt-3 inline-flex w-full justify-center text-xs font-semibold">
                Create a free account →
              </Link>
            </>
          ) : blockedByPlan ? (
            <>
              <p className="text-dash-foreground text-sm font-semibold">Included with Nexis Desk</p>
              <p className="text-dash-muted-foreground mt-1.5 text-xs leading-relaxed">
                You can look around the portal for free. Activate a semester or year plan to use this service.
              </p>
              <Link
                href="/portal/packs"
                className="bg-dash-accent mt-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              >
                View plans
              </Link>
              <Link href="/portal/titles" className="text-dash-accent mt-3 inline-flex w-full justify-center text-xs font-semibold">
                Or browse literature free →
              </Link>
            </>
          ) : blockedByWorkspace ? (
            <>
              <p className="text-dash-foreground text-sm font-semibold">Start a project workspace</p>
              <p className="text-dash-muted-foreground mt-1.5 text-xs leading-relaxed">
                Your plan is active. Create or join a workspace to open {feature.title.toLowerCase()}.
              </p>
              <Link
                href="/portal/home"
                className="bg-dash-accent mt-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              >
                Open home to start
              </Link>
            </>
          ) : (
            <>
              <p className="text-dash-foreground text-sm font-semibold">Ready to use</p>
              <Link href="/portal/home" className="bg-dash-accent mt-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white">
                Go to workspace
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
