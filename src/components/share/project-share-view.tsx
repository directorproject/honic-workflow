import { WorkflowChecklistFull } from "@/components/home/workflow-checklist-full";
import { ProjectPipelineFilesViewSection } from "@/components/projects/project-pipeline-files-view";
import { ProjectReadOnlyTimelineCard } from "@/components/projects/project-read-only-timeline-card";
import { ShareClientReferencesCard } from "@/components/share/share-client-references-card";
import { SharePushToggle } from "@/components/share/share-push-toggle";
import type { WorkflowProjectRow } from "@/lib/home-workflow-data";
import { isDriveConfigured } from "@/lib/google-drive-server";
import { loadProjectPipelineFilesForView } from "@/lib/project-pipeline-files";
import { isHighProjectPriority } from "@/lib/project-priority";
import { formatProjectType } from "@/lib/project-types";
import type { TrackedProjectDetail } from "@/lib/projects-data";
import { shareLinkPathClientSlug } from "@/lib/share-link-origin";
import { workflowStepCounts } from "@/lib/workflow-checklist";

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

function statusTone(status: string): "emerald" | "amber" | "sky" | "slate" {
  const s = status.toLowerCase();
  if (s.includes("done") || s.includes("complete")) return "emerald";
  if (s.includes("progress") || s.includes("active")) return "amber";
  if (s.includes("hold") || s.includes("wait")) return "slate";
  return "sky";
}

const statusChipClass: Record<ReturnType<typeof statusTone>, string> = {
  emerald:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100",
  amber:
    "border-amber-500/25 bg-amber-500/10 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-950 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100",
  slate:
    "border-dash-border bg-dash-muted/80 text-dash-foreground dark:border-dash-border dark:bg-dash-muted/50",
};

function SectionJumpPills() {
  const pill =
    "border-dash-border bg-dash-card/90 text-dash-foreground hover:border-dash-accent/40 hover:bg-dash-accent/8 focus-visible:ring-dash-accent inline-flex min-h-[40px] items-center justify-center rounded-full border px-4 text-xs font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none";
  return (
    <nav
      className="border-dash-border bg-dash-muted/40 mb-8 hidden gap-2 overflow-x-auto rounded-2xl border p-2 [-ms-overflow-style:none] [scrollbar-width:none] md:flex md:flex-wrap [&::-webkit-scrollbar]:hidden"
      aria-label="On this page"
    >
      <a href="#share-overview" className={pill}>
        Overview
      </a>
      <a href="#activity-checklist" className={pill}>
        Activity checklist
      </a>
      <a href="#share-files" className={pill}>
        Access files
      </a>
      <a href="#share-references" className={pill}>
        References
      </a>
    </nav>
  );
}

/**
 * Read-only project view used by public share links and the student portal's "My project" tab.
 * File previews and downloads go through the project's share token.
 */
export async function ProjectShareView({
  project,
  error,
  slug,
  token,
  badge = "Read-only share",
}: {
  project: TrackedProjectDetail;
  error?: string | null;
  slug: string;
  token: string;
  badge?: string;
}) {
  let pipelineFilesResult: Awaited<ReturnType<typeof loadProjectPipelineFilesForView>> | null = null;
  if (isDriveConfigured() && project.google_drive_folder_id) {
    pipelineFilesResult = await loadProjectPipelineFilesForView(project.google_drive_folder_id);
  }

  const canonicalClientSlug = shareLinkPathClientSlug(project.registered_clients);

  const wf = workflowStepCounts(project.workflow_checklist);
  const pct = wf.weightedPercent;
  const tone = statusTone(project.status);
  const ringR = 15.5;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - pct / 100);
  const priorityHot = isHighProjectPriority(project.priority);

  return (
    <>
      <SectionJumpPills />

      <section
        id="share-overview"
        className="border-dash-border from-dash-card to-dash-muted/30 scroll-mt-28 mb-8 rounded-3xl border bg-gradient-to-br p-5 shadow-sm sm:mb-10 sm:p-7 sm:shadow-md"
        aria-labelledby="share-project-title"
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="min-w-0 flex-1 space-y-4 lg:min-w-0">
            <div>
              <p className="text-dash-muted-foreground text-xs font-medium tracking-wide uppercase sm:text-sm">
                {project.registered_clients?.name ?? "Client"}
              </p>
              <h1
                id="share-project-title"
                className="text-dash-foreground mt-1 text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl"
              >
                {project.title}
              </h1>
              <p className="text-dash-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                <span className="bg-dash-accent/15 text-dash-accent-dim inline-flex items-center rounded-md px-2 py-0.5 font-semibold">
                  {badge}
                </span>
                <span className="hidden sm:inline">·</span>
                <span>Updates when our team publishes changes.</span>
              </p>
              <SharePushToggle slug={slug} token={token} />
            </div>

            <div className="no-scrollbar -mx-1 flex max-w-full flex-nowrap items-center justify-center gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
              <span
                className={`inline-flex shrink-0 min-h-8 max-w-[min(100%,22rem)] items-center whitespace-normal rounded-full border px-2.5 py-1 text-center text-[11px] font-semibold capitalize leading-snug sm:min-h-9 sm:max-w-none sm:px-3 sm:text-sm ${statusChipClass[tone]}`}
              >
                {project.status.replace(/_/g, " ")}
              </span>
              <span
                className={
                  priorityHot
                    ? "border-red-500/45 inline-flex shrink-0 min-h-8 max-w-[min(100%,22rem)] items-center justify-center whitespace-normal rounded-full border px-2.5 py-1 text-center text-[11px] font-semibold capitalize leading-snug text-red-600 sm:min-h-9 sm:max-w-none sm:px-3 sm:text-xs sm:text-sm dark:border-red-400/45 dark:text-red-400"
                    : "border-dash-border bg-dash-card/80 text-dash-foreground inline-flex shrink-0 min-h-8 max-w-[min(100%,22rem)] items-center whitespace-normal rounded-full border px-2.5 py-1 text-center text-[11px] font-medium capitalize leading-snug sm:min-h-9 sm:max-w-none sm:px-3 sm:text-xs sm:text-sm"
                }
              >
                {project.priority} priority
              </span>
              <span className="border-dash-border bg-dash-card/80 text-dash-muted-foreground inline-flex shrink-0 min-h-8 max-w-[55vw] items-center justify-center truncate rounded-full border px-2.5 py-1 text-center text-[11px] font-medium sm:max-w-none sm:min-h-9 sm:px-3 sm:text-xs sm:text-sm">
                <span className="sm:hidden">{formatProjectType(project.project_type, { compact: true })}</span>
                <span className="hidden sm:inline">{formatProjectType(project.project_type)}</span>
              </span>
            </div>

            <ProjectReadOnlyTimelineCard startDate={project.start_date} targetEndDate={project.target_end_date} />

            {project.description ? (
              <p
                className={
                  priorityHot
                    ? "max-w-2xl text-[13px] font-medium leading-relaxed text-red-600 sm:text-base dark:text-red-400"
                    : "text-dash-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-base"
                }
              >
                {project.description}
              </p>
            ) : null}
          </div>

          <div className="border-dash-border bg-dash-card/90 flex w-full shrink-0 flex-col justify-center rounded-2xl border p-6 sm:p-8 lg:min-w-[min(100%,22rem)] lg:max-w-xl xl:min-w-[26rem] xl:max-w-2xl">
            <p className="text-dash-muted-foreground text-center text-xs font-semibold uppercase sm:text-sm">
              Weighted pipeline
            </p>
            <div className="relative mx-auto mt-4 h-32 w-32 sm:h-36 sm:w-36 lg:h-40 lg:w-40">
              <svg className="-rotate-90 h-full w-full" viewBox="0 0 36 36" aria-hidden>
                <circle cx="18" cy="18" r={ringR} className="fill-none stroke-dash-border" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r={ringR}
                  className="fill-none stroke-dash-accent transition-[stroke-dashoffset] duration-500"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={ringC}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-dash-foreground text-2xl font-bold tabular-nums sm:text-3xl">{pct}%</span>
                <span className="text-dash-muted-foreground text-[10px] sm:text-xs">all steps</span>
              </div>
            </div>
            <p className="text-dash-muted-foreground mt-4 max-w-sm text-center text-xs leading-relaxed sm:text-sm">
              {wf.done} of {wf.inScopeTotal} steps finished on our side
              {wf.inProgress > 0 ? ` · ${wf.inProgress} underway (each adds half toward the ring)` : ""}
              {wf.notProvided > 0
                ? ` · ${wf.notProvided} handled outside our team (each counts fully toward the ring)`
                : ""}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <p className="text-dash-muted-foreground mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm" role="status">
          {error}
        </p>
      ) : null}

      <section
        id="activity-checklist"
        className="mb-10 scroll-mt-28 sm:mb-12"
        aria-labelledby="share-activity-heading"
      >
        <div className="mb-4 px-0.5 sm:mb-5">
          <h2 id="share-activity-heading" className="text-dash-foreground text-lg font-bold tracking-tight sm:text-xl">
            Activity checklist
          </h2>
          <p className="text-dash-muted-foreground mt-1 max-w-3xl text-sm leading-snug sm:text-base">
            Each stage below shows where things stand—tap or scroll to see every step.
          </p>
        </div>
        <WorkflowChecklistFull readOnly projects={[toWorkflowRow(project)]} />
      </section>

      {!isDriveConfigured() ? (
        <section
          id="share-files"
          className="border-dash-border bg-dash-muted/25 mb-10 scroll-mt-28 rounded-3xl border border-dashed px-5 py-8 sm:px-8 sm:py-10"
        >
          <p className="text-dash-foreground text-center text-sm font-semibold sm:text-base">Files are not available on this link right now</p>
          <p className="text-dash-muted-foreground mx-auto mt-2 max-w-md text-center text-sm">
            The host has not configured Google Drive for previews.
          </p>
        </section>
      ) : !project.google_drive_folder_id ? (
        <section
          id="share-files"
          className="border-dash-border bg-dash-muted/25 mb-10 scroll-mt-28 rounded-3xl border border-dashed px-5 py-8 sm:px-8 sm:py-10"
        >
          <p className="text-dash-foreground text-center text-sm font-semibold sm:text-base">No project folder linked yet</p>
          <p className="text-dash-muted-foreground mx-auto mt-2 max-w-md text-center text-sm">
            Files will appear here once the team links Google Drive.
          </p>
        </section>
      ) : pipelineFilesResult && !pipelineFilesResult.ok ? (
        <div
          id="share-files"
          role="alert"
          className="border-red-500/35 bg-red-500/10 text-red-950 dark:text-red-100 mb-10 scroll-mt-28 rounded-3xl border px-5 py-4 text-sm sm:px-6"
        >
          <p className="font-semibold">Could not load files</p>
          <p className="mt-1 opacity-90">{pipelineFilesResult.error}</p>
        </div>
      ) : pipelineFilesResult?.ok ? (
        <ProjectPipelineFilesViewSection
          projectId={project.id}
          activities={pipelineFilesResult.activities}
          shareToken={token}
          shareClientSlug={canonicalClientSlug}
          sectionId="share-files"
        />
      ) : null}

      <ShareClientReferencesCard notes={project.share_research_notes} linksRaw={project.share_research_links} />

    </>
  );
}
