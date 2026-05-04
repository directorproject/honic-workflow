"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addProjectMilestone } from "@/app/projects/actions";
import { WORKFLOW_STEPS } from "@/lib/workflow-checklist";

export function ProjectMilestoneAddForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) {
      setMessage("Choose a timeline activity.");
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      await addProjectMilestone(fd);
      form.reset();
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add milestone.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-dash-border mt-5 border-t border-dashed pt-5">
      <p className="text-dash-foreground mb-3 text-xs font-semibold">Add milestone</p>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <input type="hidden" name="tracked_project_id" value={projectId} />
        <div>
          <label htmlFor="new-ms-activity" className="text-dash-muted-foreground mb-1 block text-[11px] font-medium">
            Timeline activity <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <select
            id="new-ms-activity"
            name="title"
            required
            disabled={pending}
            defaultValue=""
            className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:opacity-50"
          >
            <option value="" disabled>
              Choose pipeline activity…
            </option>
            {WORKFLOW_STEPS.map((s) => (
              <option key={s.key} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-dash-muted-foreground mt-1 text-[11px] leading-relaxed">
            Same steps as the project checklist and Drive activity folders.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="new-ms-date" className="text-dash-muted-foreground mb-1 block text-[11px] font-medium">
              Target date <span className="font-normal opacity-80">(optional)</span>
            </label>
            <input
              id="new-ms-date"
              name="target_date"
              type="date"
              disabled={pending}
              className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="new-ms-assignee" className="text-dash-muted-foreground mb-1 block text-[11px] font-medium">
              Assigned to <span className="font-normal opacity-80">(optional)</span>
            </label>
            <input
              id="new-ms-assignee"
              name="assignee"
              type="text"
              disabled={pending}
              placeholder="Name"
              autoComplete="name"
              className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:opacity-50"
            />
          </div>
        </div>
        {message ? (
          <p className="text-red-600 dark:text-red-300 text-xs" role="alert">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add milestone"}
        </button>
      </form>
    </div>
  );
}
