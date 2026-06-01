"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { deleteProjectMilestone, updateProjectMilestone } from "@/app/projects/actions";
import { MilestoneWorkStatusSelect } from "@/components/plans/milestone-work-status-select";
import type { ProjectMilestoneRow } from "@/lib/projects-data";
import { normalizeMilestoneWorkStatus } from "@/lib/milestone-work-status";
import { WORKFLOW_STEPS } from "@/lib/workflow-checklist";

function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ProjectMilestoneItem({
  projectId,
  milestone,
}: {
  projectId: string;
  milestone: ProjectMilestoneRow;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const titleOptions = useMemo(() => {
    const labels: string[] = WORKFLOW_STEPS.map((s) => s.label);
    if (milestone.title && !labels.includes(milestone.title)) {
      return [milestone.title, ...labels];
    }
    return labels;
  }, [milestone.title]);

  const isDone = Boolean(milestone.completed_at) || normalizeMilestoneWorkStatus(milestone.work_status) === "done";

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    setMessage(null);
    try {
      await updateProjectMilestone(fd);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save milestone.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (
      !window.confirm(
        `Delete milestone "${milestone.title}"? Linked extra tasks will stay but lose this milestone link.`,
      )
    ) {
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("milestone_id", milestone.id);
      fd.set("tracked_project_id", projectId);
      await deleteProjectMilestone(fd);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not delete milestone.");
      setPending(false);
    }
  }

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span
        className="bg-dash-accent mt-1.5 h-2 w-2 shrink-0 rounded-full ring-2 ring-dash-card"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={(e) => void onSave(e)} className="space-y-3">
            <input type="hidden" name="milestone_id" value={milestone.id} />
            <input type="hidden" name="tracked_project_id" value={projectId} />
            <div>
              <label
                htmlFor={`ms-title-${milestone.id}`}
                className="text-dash-muted-foreground mb-1 block text-[11px] font-medium"
              >
                Activity name
              </label>
              <select
                id={`ms-title-${milestone.id}`}
                name="title"
                required
                disabled={pending}
                defaultValue={milestone.title}
                className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-50"
              >
                {titleOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={`ms-date-${milestone.id}`}
                className="text-dash-muted-foreground mb-1 block text-[11px] font-medium"
              >
                Target date
              </label>
              <input
                id={`ms-date-${milestone.id}`}
                name="target_date"
                type="date"
                disabled={pending}
                defaultValue={milestone.target_date ?? ""}
                className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-50"
              />
            </div>
            {message ? (
              <p className="text-red-600 dark:text-red-300 text-xs" role="alert">
                {message}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pending}
                className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setMessage(null);
                }}
                className="border-dash-border bg-dash-muted hover:bg-dash-border rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-dash-foreground font-medium">{milestone.title}</p>
            <p className="text-dash-muted-foreground mt-0.5 text-xs tabular-nums">
              {milestone.completed_at
                ? `Completed ${new Date(milestone.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                : milestone.target_date
                  ? `Target ${formatIsoDate(milestone.target_date) ?? milestone.target_date}`
                  : "No target date"}
            </p>
            {milestone.assignee?.trim() ? (
              <p className="text-dash-muted-foreground mt-1 text-xs">
                Assigned to <span className="text-dash-foreground font-medium">{milestone.assignee.trim()}</span>
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-dash-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                Workflow
              </span>
              {isDone ? (
                <span className="border-dash-border text-dash-muted-foreground inline-flex rounded-full border bg-dash-muted/30 px-2 py-0.5 text-[11px] font-semibold">
                  Done
                </span>
              ) : (
                <MilestoneWorkStatusSelect
                  milestoneId={milestone.id}
                  value={normalizeMilestoneWorkStatus(milestone.work_status)}
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditing(true)}
                className="text-dash-accent text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50"
              >
                Edit name & date
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void onDelete()}
                className="text-red-600 dark:text-red-400 text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-50"
              >
                Delete
              </button>
            </div>
            {message ? (
              <p className="text-red-600 dark:text-red-300 mt-2 text-xs" role="alert">
                {message}
              </p>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}
