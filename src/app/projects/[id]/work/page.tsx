import Link from "next/link";
import { notFound } from "next/navigation";

import { WorkflowChecklistFull } from "@/components/home/workflow-checklist-full";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProjectDriveUploadForm } from "@/components/projects/project-drive-upload-form";
import { ProjectMilestoneAddForm } from "@/components/projects/project-milestone-add-form";
import { ProjectTasksPanel } from "@/components/projects/project-tasks-panel";
import { loadDashboardData } from "@/lib/dashboard-data";
import type { WorkflowProjectRow } from "@/lib/home-workflow-data";
import { formatProjectType } from "@/lib/project-types";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { isHighProjectPriority } from "@/lib/project-priority";
import { getPublicSiteBaseUrl } from "@/app/projects/[id]/share-actions";
import { RegisteredClientEditor } from "@/components/projects/registered-client-editor";
import { ProjectShareLinkPanel } from "@/components/projects/project-share-link-panel";
import { buildShareLinkOrigin, shareLinkPathClientSlug } from "@/lib/share-link-origin";
import { isDriveConfigured } from "@/lib/google-drive-server";
import { listShareLinksForProject } from "@/lib/project-share";
import { ProjectLoadFailureNotice } from "@/components/projects/project-load-failure-notice";
import { ProjectShareReferencesForm } from "@/components/projects/project-share-references-form";
import { ProjectMilestoneItem } from "@/components/projects/project-milestone-item";
import { normalizeShareResearchLinks } from "@/lib/share-client-references";
import {
  loadProjectDetail,
  PROJECT_DETAIL_NOT_FOUND_MESSAGE,
  type TrackedProjectDetail,
} from "@/lib/projects-data";

function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

export default async function ProjectWorkPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const dash = await loadDashboardData();
  const { project, milestones, tasks, error } = await loadProjectDetail(id);

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

  const driveReady = isDriveConfigured();
  const projectDriveFolderId = project.google_drive_folder_id;
  const shareLinks = await listShareLinksForProject(project.id);
  const fallbackOrigin = await getPublicSiteBaseUrl();
  const shareLinkOrigin = buildShareLinkOrigin(project.registered_clients, fallbackOrigin);
  const shareClientSlug = shareLinkPathClientSlug(project.registered_clients);

  return (
    <DashboardShell
      title={project.title}
      subtitle={`${project.registered_clients?.name ?? "Registered client"} · Milestones & extra tasks`}
      statusDotClass={statusDotClass}
    >
      <p className="text-dash-muted-foreground mb-6 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        <Link
          href={`/projects/${project.id}`}
          className="text-dash-accent font-semibold underline-offset-2 hover:underline"
        >
          Open view-only summary
        </Link>
        <span className="text-dash-border hidden sm:inline">|</span>
        <Link href="/projects" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
          All projects
        </Link>
      </p>

      {error ? (
        <p className="text-dash-muted-foreground mb-4 text-sm">{error}</p>
      ) : null}

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

      {project.registered_client_id ? (
        <RegisteredClientEditor
          projectId={project.id}
          initialProjectTitle={project.title}
          initialProjectType={project.project_type}
          initialPriority={project.priority}
          initialDescription={project.description}
          initialName={project.registered_clients?.name ?? ""}
          initialShareSubdomain={project.registered_clients?.share_subdomain ?? null}
          initialPhone={project.registered_clients?.phone ?? null}
        />
      ) : null}

      <ProjectShareLinkPanel
        projectId={project.id}
        existingLinks={shareLinks}
        shareLinkOrigin={shareLinkOrigin}
        shareClientSlug={shareClientSlug}
      />

      <section
        id="activity-checklist"
        className="border-dash-border bg-dash-card mb-10 scroll-mt-28 rounded-2xl border p-5 shadow-sm sm:p-6"
        aria-labelledby="work-checklist-heading"
      >
        <h2 id="work-checklist-heading" className="text-dash-foreground mb-1 text-lg font-semibold">
          Pipeline & activity
        </h2>
        <p className="text-dash-muted-foreground mb-5 text-sm">
          Update each step from schematic through handoff (saved immediately). Use <span className="text-dash-foreground font-medium">Outside our scope</span>{" "}
          when your team does not deliver that step (another party provides it)—those steps are skipped for completion,
          not treated as pending work. When every step through <span className="text-dash-foreground font-medium">Full project test</span>{" "}
          is done, the project moves to <Link href="/client-side" className="text-dash-accent font-medium underline-offset-2 hover:underline">Client side</Link>;
          at <span className="text-dash-foreground font-medium">100%</span> it becomes <span className="text-dash-foreground font-medium">Completed</span>.
          A progress bar below shows live counts;{" "}
          <span className="text-dash-foreground font-medium">View summary page →</span> opens the read-only overview.
        </p>
        <WorkflowChecklistFull projects={[toWorkflowRow(project)]} />
      </section>

      {driveReady && projectDriveFolderId ? (
        <ProjectDriveUploadForm
          projectId={project.id}
          heading="Upload files to this project"
          intro="Upload a new file, or switch to “Use file already in project folder” to open the client project folder, pick an existing file, and move it into the pipeline activity subfolder (same steps as above)."
        />
      ) : driveReady && !projectDriveFolderId ? (
        <div
          role="status"
          className="border-dash-border bg-dash-muted/30 mb-8 rounded-2xl border border-dashed px-5 py-6"
        >
          <p className="text-dash-foreground text-sm font-medium">Connect a Drive folder to upload files.</p>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            Configure the project folder on the Files page, then uploads here and there will work.
          </p>
          <Link
            href={`/projects/${project.id}/files`}
            className="text-dash-accent mt-3 inline-block text-sm font-semibold underline-offset-2 hover:underline"
          >
            Open Files &amp; Drive setup →
          </Link>
        </div>
      ) : (
        <div
          role="status"
          className="border-dash-border bg-dash-muted/30 mb-8 rounded-2xl border border-dashed px-5 py-6"
        >
          <p className="text-dash-foreground text-sm font-medium">Drive uploads are not configured.</p>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            Set service account and folder env vars to enable uploads from Manage and Files.
          </p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="border-dash-border bg-dash-card rounded-2xl border p-5 shadow-sm">
          <h2 className="text-dash-foreground mb-1 text-base font-semibold">Timeline</h2>
          <p className="text-dash-muted-foreground mb-4 text-xs">
            Add milestones here or when creating a project. Use <span className="text-dash-foreground font-medium">Edit milestone</span>{" "}
            for name, date, and assignee, or <span className="text-dash-foreground font-medium">Delete</span> on each row. Set workflow status below (or mark done from the{" "}
            <span className="text-dash-foreground font-medium">Plans</span> page checkbox).
          </p>
          {milestones.length === 0 ? (
            <p className="text-dash-muted-foreground mb-1 text-sm">No milestones yet — add one below.</p>
          ) : (
            <ul className="relative space-y-0 pl-1 text-sm before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-dash-border">
              {milestones.map((m) => (
                <ProjectMilestoneItem key={m.id} projectId={project.id} milestone={m} />
              ))}
            </ul>
          )}
          <ProjectMilestoneAddForm projectId={project.id} />
        </section>

        <section className="border-dash-border bg-dash-card rounded-2xl border p-5 shadow-sm">
          <h2 className="text-dash-foreground mb-1 text-base font-semibold">Extra tasks</h2>
          <p className="text-dash-muted-foreground mb-4 text-xs">
            Informal follow-ups outside the timeline; add items, assign people, set due dates, and track status.
          </p>
          <ProjectTasksPanel projectId={project.id} tasks={tasks} />
        </section>
      </div>

      <div className="mt-10">
        <ProjectShareReferencesForm
          projectId={project.id}
          initialNotes={project.share_research_notes}
          initialLinks={normalizeShareResearchLinks(project.share_research_links)}
        />
      </div>

      <p className="text-dash-muted-foreground mt-10 flex flex-wrap gap-4 text-xs">
        <Link href={`/projects/${project.id}`} className="text-dash-accent font-semibold underline-offset-2 hover:underline">
          View summary
        </Link>
        <Link href="/projects" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
          All projects
        </Link>
        <Link href="/" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
          Home
        </Link>
      </p>
    </DashboardShell>
  );
}
