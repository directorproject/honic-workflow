import Link from "next/link";
import { notFound } from "next/navigation";

import { WorkflowChecklistFull } from "@/components/home/workflow-checklist-full";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { loadDashboardData } from "@/lib/dashboard-data";
import type { WorkflowProjectRow } from "@/lib/home-workflow-data";
import { ProjectPipelineFilesViewSection } from "@/components/projects/project-pipeline-files-view";
import { isDriveConfigured } from "@/lib/google-drive-server";
import { loadProjectPipelineFilesForView } from "@/lib/project-pipeline-files";
import { formatProjectType } from "@/lib/project-types";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { isHighProjectPriority } from "@/lib/project-priority";
import { ProjectReadOnlyTimelineCard } from "@/components/projects/project-read-only-timeline-card";
import { ProjectLoadFailureNotice } from "@/components/projects/project-load-failure-notice";
import {
  loadProjectDetail,
  PROJECT_DETAIL_NOT_FOUND_MESSAGE,
  type TrackedProjectDetail,
} from "@/lib/projects-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function ProjectSummaryNavLinks({ projectId }: { projectId: string }) {
  return (
    <nav
      className="text-dash-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-xs"
      aria-label="Project shortcuts"
    >
      <Link
        href={`/projects/${projectId}/files`}
        className="text-dash-accent font-semibold underline-offset-2 hover:underline"
      >
        Project files (Drive)
      </Link>
      <Link
        href={`/projects/${projectId}/work`}
        className="text-dash-accent font-semibold underline-offset-2 hover:underline"
      >
        Manage progress & milestones
      </Link>
      <Link href="/projects" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
        ← All projects
      </Link>
      <Link href="/" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
        Home
      </Link>
    </nav>
  );
}

function toWorkflowRow(project: TrackedProjectDetail): WorkflowProjectRow {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    priority: project.priority,
    project_type: project.project_type,
    workflow_checklist: project.workflow_checklist,
    registered_client_id: project.registered_client_id,
    registered_clients: project.registered_clients,
    timeline_summary: "—",
  };
}

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const dash = await loadDashboardData();
  const { project, error } = await loadProjectDetail(id);

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

  let pipelineFilesResult: Awaited<ReturnType<typeof loadProjectPipelineFilesForView>> | null = null;
  if (isDriveConfigured() && project.google_drive_folder_id) {
    pipelineFilesResult = await loadProjectPipelineFilesForView(project.google_drive_folder_id);
  }

  return (
    <DashboardShell
      title={project.title}
      subtitle={project.registered_clients?.name ?? "Registered client"}
      statusDotClass={statusDotClass}
      headerBelow={<ProjectSummaryNavLinks projectId={project.id} />}
    >
      {error ? (
        <p className="text-dash-muted-foreground mb-4 text-sm">{error}</p>
      ) : null}

      {project.registered_clients?.phone?.trim() ? (
        <p className="text-dash-muted-foreground mb-4 text-sm">
          <span className="text-dash-foreground font-medium">Client phone</span>{" "}
          <a
            href={`tel:${project.registered_clients.phone.trim().replace(/\s/g, "")}`}
            className="text-dash-accent font-semibold underline-offset-2 hover:underline"
          >
            {project.registered_clients.phone.trim()}
          </a>
        </p>
      ) : null}

      <div className="no-scrollbar -mx-1 mb-6 flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-0.5 text-[11px] font-medium capitalize [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 sm:text-xs [&::-webkit-scrollbar]:hidden">
        <span className="border-dash-border max-w-[min(100%,20rem)] shrink-0 whitespace-normal rounded-full border px-2.5 py-1 text-center capitalize leading-snug sm:max-w-none sm:px-3">
          {project.status.replace(/_/g, " ")}
        </span>
        <span
          className={
            priorityHot
              ? "max-w-[min(100%,20rem)] shrink-0 whitespace-normal text-center text-xs font-semibold capitalize leading-snug text-red-600 sm:max-w-none dark:text-red-400"
              : "border-dash-border max-w-[min(100%,20rem)] shrink-0 whitespace-normal rounded-full border px-2.5 py-1 text-center capitalize leading-snug sm:max-w-none sm:px-3"
          }
        >
          {project.priority} priority
        </span>
        <span className="border-dash-border max-w-[55vw] shrink-0 truncate rounded-full border px-2.5 py-1 sm:max-w-none sm:px-3">
          <span className="sm:hidden">{formatProjectType(project.project_type, { compact: true })}</span>
          <span className="hidden sm:inline">{formatProjectType(project.project_type)}</span>
        </span>
      </div>

      <ProjectReadOnlyTimelineCard startDate={project.start_date} targetEndDate={project.target_end_date} />

      {project.description ? (
        <p
          className={
            priorityHot
              ? "mb-8 max-w-3xl text-sm font-medium leading-relaxed text-red-600 dark:text-red-400"
              : "text-dash-muted-foreground mb-8 max-w-3xl text-sm leading-relaxed"
          }
        >
          {project.description}
        </p>
      ) : null}

      <section
        id="activity-checklist"
        className="border-dash-border bg-dash-card mb-10 scroll-mt-28 rounded-2xl border p-5 shadow-sm sm:p-6"
        aria-labelledby="activity-checklist-heading"
      >
        <h2 id="activity-checklist-heading" className="text-dash-foreground mb-1 text-lg font-semibold">
          Full activity checklist
        </h2>
        <p className="text-dash-muted-foreground mb-5 text-sm">
          Pipeline steps from schematic through handoff (view only on this page).
        </p>
        <WorkflowChecklistFull readOnly projects={[toWorkflowRow(project)]} />
      </section>

      {!isDriveConfigured() ? (
        <section className="border-dash-border bg-dash-muted/30 mb-10 rounded-2xl border border-dashed px-5 py-6">
          <p className="text-dash-foreground text-sm font-medium">Drive file previews unavailable</p>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            Configure Google Drive in <code className="text-dash-foreground text-xs">.env.local</code> to list uploads by
            pipeline activity here.
          </p>
        </section>
      ) : !project.google_drive_folder_id ? (
        <section className="border-dash-border bg-dash-muted/30 mb-10 rounded-2xl border border-dashed px-5 py-6">
          <p className="text-dash-foreground text-sm font-medium">No project Drive folder yet</p>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            Link a folder on the Files page to see uploads grouped by pipeline step.
          </p>
          <Link
            href={`/projects/${project.id}/files`}
            className="text-dash-accent mt-3 inline-block text-sm font-semibold underline-offset-2 hover:underline"
          >
            Open Files →
          </Link>
        </section>
      ) : pipelineFilesResult && !pipelineFilesResult.ok ? (
        <div
          role="alert"
          className="border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-100 mb-10 rounded-2xl border px-4 py-3 text-sm"
        >
          <p className="font-medium">Could not load pipeline folders</p>
          <p className="mt-1 opacity-90">{pipelineFilesResult.error}</p>
        </div>
      ) : pipelineFilesResult?.ok ? (
        <ProjectPipelineFilesViewSection projectId={project.id} activities={pipelineFilesResult.activities} />
      ) : null}

      <div className="mt-10">
        <ProjectSummaryNavLinks projectId={project.id} />
      </div>
    </DashboardShell>
  );
}
