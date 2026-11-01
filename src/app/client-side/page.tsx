import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeleteTrackedProjectButton } from "@/components/projects/delete-tracked-project-button";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { formatProjectType } from "@/lib/project-types";
import { loadProjectsList } from "@/lib/projects-data";
import { workflowStepCounts } from "@/lib/workflow-checklist";

function formatDate(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const dynamic = "force-dynamic";

export default async function ClientSideProjectsPage() {
  const dash = await loadDashboardData();
  const { projects, error } = await loadProjectsList(undefined, { status: "client_side" });

  const connected = isDashboardRegistryOk(dash.banner);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  return (
    <DashboardShell
      title="Client side"
      subtitle="Our pipeline through Full project test is done — client check and handoff remain."
      statusDotClass={statusDotClass}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-dash-muted-foreground text-sm">
          {projects.length} project{projects.length === 1 ? "" : "s"} waiting on client check or delivery.
          Projects move here automatically when every step through{" "}
          <span className="text-dash-foreground font-medium">Full project test</span> is done.
        </p>
        <Link
          href="/projects"
          className="border-dash-border bg-dash-muted hover:bg-dash-border inline-flex rounded-xl border px-4 py-2 text-sm font-semibold transition-colors"
        >
          Active projects
        </Link>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-dash-border bg-dash-card mb-6 rounded-2xl border border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          <p className="font-medium">Could not load client-side projects.</p>
          <p className="mt-1 opacity-90">{error}</p>
          <p className="text-dash-muted-foreground mt-2 text-xs">
            If status <code className="text-dash-foreground">client_side</code> is unknown, run{" "}
            <code className="text-dash-foreground">supabase/v2/001_dashboard_baseline.sql</code>.
          </p>
        </div>
      ) : null}

      <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border shadow-sm">
        <table className="divide-dash-border min-w-full divide-y text-sm">
          <thead className="bg-dash-muted/80">
            <tr className="text-dash-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
              <th className="px-5 py-3.5">Project</th>
              <th className="px-5 py-3.5">Client</th>
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5">Pipeline</th>
              <th className="px-5 py-3.5">Updated</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-dash-border divide-y">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-dash-muted-foreground px-5 py-14 text-center">
                  No projects on the client side yet. Finish pipeline steps through Full project test on{" "}
                  <Link href="/projects" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
                    Active projects
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              projects.map((p) => {
                const pct = workflowStepCounts(p.workflow_checklist ?? null).weightedPercent;
                return (
                  <tr key={p.id} className="hover:bg-dash-muted/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-dash-foreground font-medium underline-offset-2 hover:underline"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="text-dash-muted-foreground px-5 py-3.5">
                      {p.registered_clients?.name ?? "—"}
                    </td>
                    <td className="text-dash-muted-foreground px-5 py-3.5 text-sm">
                      {formatProjectType(p.project_type)}
                    </td>
                    <td className="text-dash-muted-foreground px-5 py-3.5 tabular-nums">{pct}%</td>
                    <td className="text-dash-muted-foreground px-5 py-3.5 tabular-nums">{formatDate(p.updated_at)}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex shrink-0 items-center justify-end gap-2">
                        <Link
                          href={`/projects/${p.id}/work`}
                          className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors"
                        >
                          Manage
                        </Link>
                        <DeleteTrackedProjectButton projectId={p.id} title={p.title} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-dash-muted-foreground mt-8 text-center text-xs">
        At <span className="text-dash-foreground font-medium">100%</span> weighted pipeline, projects move to{" "}
        <span className="text-dash-foreground font-medium">Completed</span> and leave this list.
      </p>
    </DashboardShell>
  );
}
