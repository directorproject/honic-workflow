import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatusBanner } from "@/components/dashboard/status-banner";
import { HomeStudentsPanel } from "@/components/home/home-students-panel";
import { HomeSummaryCards } from "@/components/home/home-summary-cards";
import { WorkflowTableMinimal } from "@/components/home/workflow-table-minimal";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { loadHomeWorkflowPage } from "@/lib/home-workflow-data";

/** Core product: fresh Supabase data every request (not prerendered static HTML). */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { banner, projects, summaries } = await loadHomeWorkflowPage();

  const connected = isDashboardRegistryOk(banner);
  const statusDotClass = connected ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]" : "bg-amber-500";

  return (
    <DashboardShell
      title="Project workflow"
      subtitle="Project pipeline on home. Students, title requests, and Help desk chat are in the portal system below."
      statusDotClass={statusDotClass}
    >
      <StatusBanner banner={banner} />

      <section id="overview" className="mt-6 scroll-mt-28 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">Summary</h2>
            <p className="text-dash-muted-foreground text-sm">
              Counts for the selected working year. Client side is listed last.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/projects/new"
              className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            >
              New project
            </Link>
            <p className="text-dash-muted-foreground text-xs font-medium tabular-nums">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
        <HomeSummaryCards s={summaries} />
      </section>

      <HomeStudentsPanel />

      <section id="workflow" className="mt-10 scroll-mt-28 space-y-4">
        <div>
          <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">Activity overview</h2>
          <p className="text-dash-muted-foreground mt-1 max-w-3xl text-sm">
            Key status per project.{" "}
            <span className="font-medium text-dash-foreground">Pipeline</span> counts checklist progress (steps marked{" "}
            <span className="font-medium text-dash-foreground">outside our scope</span> are someone else’s deliverable,
            not ours to finish); <span className="font-medium text-dash-foreground">Timeline</span> shows dates and
            milestones. View for read-only summary; Manage to edit pipeline, milestones, and extra tasks.{" "}
            <Link href="/plans" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
              This week milestones
            </Link>{" "}
            lists dated pending milestones for the current week plus overdue items across all projects (optional client
            filter).
          </p>
        </div>
        <WorkflowTableMinimal projects={projects} />
      </section>

      <footer className="text-dash-muted-foreground mt-12 border-t border-dashed border-slate-300/60 pt-8 text-center text-xs dark:border-slate-600/60">
        <Link href="/users" className="text-dash-accent font-medium underline-offset-2 hover:underline">
          Registered users
        </Link>
        {" · "}
        <Link href="/users/requests" className="text-dash-accent font-medium underline-offset-2 hover:underline">
          Requested titles
        </Link>
        {" · "}
        <Link href="/students/help-desk" className="text-dash-accent font-medium underline-offset-2 hover:underline">
          Help desk
        </Link>
        {" · "}
        <Link href="/projects" className="text-dash-accent font-medium underline-offset-2 hover:underline">
          Project list
        </Link>
        {" · "}
        <Link href="/plans" className="text-dash-accent font-medium underline-offset-2 hover:underline">
          This week milestones
        </Link>
      </footer>
    </DashboardShell>
  );
}
