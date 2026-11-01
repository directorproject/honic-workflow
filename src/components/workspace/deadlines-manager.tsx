"use client";

import { deleteDeadlineAction, saveDeadlineAction } from "@/app/portal/workspace-actions";
import { useRun } from "@/components/workspace/ws-context";
import { BTN, BTN_DANGER, Empty, INPUT, Label, Panel, Status } from "@/components/workspace/ws-ui";
import { INSTITUTIONS, PROJECT_CATEGORIES, projectCategoryLabel } from "@/lib/portal/config";
import { formatDate, relativeDays, todayIso } from "@/lib/workspace/dates";
import type { SharedDeadline } from "@/lib/workspace/types";

export function DeadlinesManager({ deadlines, courses }: { deadlines: SharedDeadline[]; courses: { code: string; name: string }[] }) {
  const { run, pending, status } = useRun();
  const today = todayIso();
  return (
    <>
      <Panel title="Add a shared deadline" subtitle="It appears in the calendar of every matching student. Leave a filter empty to include everyone.">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const g = (k: string) => String(fd.get(k) ?? "");
            run(
              () =>
                saveDeadlineAction(null, {
                  title: g("title"),
                  dueDate: g("due"),
                  institution: g("institution"),
                  courseCode: g("course"),
                  projectCategory: g("category"),
                  notes: g("notes"),
                }),
              { ok: "Deadline added.", onOk: () => (e.target as HTMLFormElement).reset() },
            );
          }}
        >
          <Label text="Deadline" wide>
            <input name="title" required maxLength={160} placeholder="e.g. Proposal submission" className={INPUT} />
          </Label>
          <Label text="Date">
            <input name="due" type="date" required className={INPUT} />
          </Label>
          <Label text="Institution">
            <select name="institution" className={INPUT}>
              <option value="">All institutions</option>
              {INSTITUTIONS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Label>
          <Label text="Course">
            <select name="course" className={INPUT}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} – {c.name}
                </option>
              ))}
            </select>
          </Label>
          <Label text="Project type">
            <select name="category" className={INPUT}>
              <option value="">All types</option>
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Label>
          <Label text="Notes" wide>
            <input name="notes" maxLength={1000} className={INPUT} />
          </Label>
          <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
            <button type="submit" disabled={pending} className={BTN}>
              Add deadline
            </button>
            <Status status={status} />
          </div>
        </form>
      </Panel>

      <Panel title="Shared deadlines">
        {deadlines.length ? (
          <ul className="divide-dash-border divide-y">
            {deadlines.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${d.due_date < today ? "text-dash-muted-foreground" : "text-dash-foreground"}`}>{d.title}</p>
                  <p className="text-dash-muted-foreground text-xs">
                    {formatDate(d.due_date, { weekday: "short" })} ({relativeDays(d.due_date, today)}) ·{" "}
                    {[d.institution ?? "All institutions", d.course_code ?? "all courses", projectCategoryLabel(d.project_category) ?? "all types"].join(" · ")}
                  </p>
                  {d.notes ? <p className="text-dash-muted-foreground text-xs">{d.notes}</p> : null}
                </div>
                <button type="button" className={BTN_DANGER} onClick={() => window.confirm(`Delete "${d.title}"?`) && run(() => deleteDeadlineAction(d.id))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No shared deadlines yet" />
        )}
      </Panel>
    </>
  );
}
