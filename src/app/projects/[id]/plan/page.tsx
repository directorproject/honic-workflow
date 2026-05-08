import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProjectMilestonePlansView } from "@/components/projects/project-milestone-plans-view";
import { ProjectLoadFailureNotice } from "@/components/projects/project-load-failure-notice";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { isHighProjectPriority } from "@/lib/project-priority";
import { formatProjectType } from "@/lib/project-types";
import { buildMilestonePlans } from "@/lib/project-milestone-plans";
import {
  loadProjectDetail,
  PROJECT_DETAIL_NOT_FOUND_MESSAGE,
} from "@/lib/projects-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function ProjectPlanPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const dash = await loadDashboardData();
  const { project, milestones, error } = await loadProjectDetail(id);

  if (!project) {
    if (error !== PROJECT_DETAIL_NOT_FOUND_MESSAGE) {
      return <ProjectLoadFailureNotice message={error ?? "Unknown error."} />;
    }
    notFound();
  }

  const connected = isDashboardRegistryOk(dash.banner);
  const priorityHot = isHighProjectPriority(project.priority);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  const plans = buildMilestonePlans(milestones, 7);
  const pendingCount = milestones.filter((m) => !m.completed_at).length;

  return (
    <DashboardShell
      title={`${project.title} — Plans`}
      subtitle={`${project.registered_clients?.name ?? "Registered client"} · Rolling daily & weekly outline from milestones`}
      statusDotClass={statusDotClass}
    >
      <p className="text-dash-muted-foreground mb-6 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        <Link
          href={`/projects/${project.id}/work`}
          className="text-dash-accent font-semibold underline-offset-2 hover:underline"
        >
          Manage milestones
        </Link>
        <span className="text-dash-border hidden sm:inline">|</span>
        <Link href={`/projects/${project.id}`} className="text-dash-accent font-semibold underline-offset-2 hover:underline">
          View summary
        </Link>
        <span className="text-dash-border hidden sm:inline">|</span>
        <Link href="/projects" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
          All projects
        </Link>
      </p>

      {error ? <p className="text-dash-muted-foreground mb-4 text-sm">{error}</p> : null}

      <div className="no-scrollbar -mx-1 mb-6 flex max-w-full flex-nowrap items-center justify-center gap-1.5 overflow-x-auto px-1 pb-0.5 text-[11px] font-medium capitalize [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 sm:text-xs [&::-webkit-scrollbar]:hidden">
        <span className="border-dash-border inline-flex min-h-8 max-w-[min(100%,20rem)] shrink-0 items-center justify-center whitespace-normal rounded-full border px-2.5 py-1 text-center capitalize leading-snug sm:min-h-9 sm:max-w-none sm:px-3">
          {project.status.replace(/_/g, " ")}
        </span>
        <span
          className={
            priorityHot
              ? "border-red-500/45 inline-flex min-h-8 max-w-[min(100%,20rem)] shrink-0 items-center justify-center whitespace-normal rounded-full border px-2.5 py-1 text-center text-xs font-semibold capitalize leading-snug text-red-600 sm:min-h-9 sm:max-w-none sm:px-3 dark:border-red-400/45 dark:text-red-400"
              : "border-dash-border inline-flex min-h-8 max-w-[min(100%,20rem)] shrink-0 items-center justify-center whitespace-normal rounded-full border px-2.5 py-1 text-center capitalize leading-snug sm:min-h-9 sm:max-w-none sm:px-3"
          }
        >
          {project.priority} priority
        </span>
        <span className="border-dash-border inline-flex min-h-8 max-w-[55vw] shrink-0 items-center justify-center rounded-full border px-2.5 py-1 text-center sm:min-h-9 sm:max-w-none sm:px-3">
          <span className="sm:hidden">{formatProjectType(project.project_type, { compact: true })}</span>
          <span className="hidden sm:inline">{formatProjectType(project.project_type)}</span>
        </span>
      </div>

      {project.start_date || project.target_end_date ? (
        <p className="text-dash-muted-foreground mb-6 text-sm">
          {formatIsoDate(project.start_date) ? (
            <span>
              Start: <span className="text-dash-foreground font-medium">{formatIsoDate(project.start_date)}</span>
            </span>
          ) : null}
          {project.start_date && project.target_end_date ? <span> · </span> : null}
          {formatIsoDate(project.target_end_date) ? (
            <span>
              Target end:{" "}
              <span className="text-dash-foreground font-medium">{formatIsoDate(project.target_end_date)}</span>
            </span>
          ) : null}
        </p>
      ) : null}

      <section className="border-dash-border bg-dash-card mb-10 rounded-2xl border p-5 shadow-sm sm:p-6">
        <h2 className="text-dash-foreground mb-2 text-base font-semibold">How this page works</h2>
        <p className="text-dash-muted-foreground max-w-3xl text-sm leading-relaxed">
          This is a read-only outline built from your pipeline milestones. It does not replace tasks or the checklist;
          use it for day-to-day and week-level orientation. Edit milestone titles, target dates, and assignees on the{" "}
          <Link href={`/projects/${project.id}/work`} className="text-dash-accent font-semibold hover:underline">
            Manage
          </Link>{" "}
          page.
        </p>
        <p className="text-dash-muted-foreground mt-3 text-sm">
          Pending milestones: <span className="text-dash-foreground font-medium tabular-nums">{pendingCount}</span>
        </p>
      </section>

      <ProjectMilestonePlansView
        projectId={project.id}
        overdue={plans.overdue}
        daily={plans.daily}
        weekly={plans.weekly}
        pendingUndatedCount={plans.pendingUndated.length}
      />

      <p className="text-dash-muted-foreground mt-10 flex flex-wrap gap-4 text-xs">
        <Link href={`/projects/${project.id}/work`} className="text-dash-accent font-semibold underline-offset-2 hover:underline">
          Manage
        </Link>
        <Link href={`/projects/${project.id}`} className="text-dash-accent font-semibold underline-offset-2 hover:underline">
          View summary
        </Link>
        <Link href="/projects" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
          All projects
        </Link>
      </p>
    </DashboardShell>
  );
}
