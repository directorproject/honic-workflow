import Link from "next/link";

import type {
  DailyPlanRow,
  MilestoneForPlan,
  WeeklyPlanBucket,
} from "@/lib/project-milestone-plans";

function assigneeLine(assignee: string | null | undefined) {
  const t = assignee?.trim();
  if (!t) return null;
  return <p className="text-dash-muted-foreground mt-0.5 text-xs">Assigned to {t}</p>;
}

export function ProjectMilestonePlansView({
  projectId,
  overdue,
  daily,
  weekly,
  pendingUndatedCount,
}: {
  projectId: string;
  overdue: MilestoneForPlan[];
  daily: DailyPlanRow[];
  weekly: WeeklyPlanBucket[];
  pendingUndatedCount: number;
}) {
  return (
    <div className="space-y-10">
      {overdue.length > 0 ? (
        <section
          aria-labelledby="overdue-heading"
          className="border-amber-500/40 bg-amber-500/10 rounded-2xl border px-4 py-4 sm:px-5"
        >
          <h2 id="overdue-heading" className="text-dash-foreground mb-2 text-base font-semibold">
            Overdue targets
          </h2>
          <p className="text-dash-muted-foreground mb-3 text-sm">
            These milestones still need a completion date or an updated target — they will not appear in the next seven
            days until you reschedule them on{" "}
            <Link href={`/projects/${projectId}/work`} className="text-dash-accent font-semibold hover:underline">
              Manage
            </Link>
            .
          </p>
          <ul className="space-y-2">
            {overdue.map((m) => {
              const raw = m.target_date?.trim();
              const label =
                raw && !Number.isNaN(new Date(`${raw}T12:00:00`).getTime())
                  ? new Date(`${raw}T12:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : null;
              return (
                <li key={m.id} className="text-dash-foreground text-sm font-medium">
                  {m.title}
                  {label ? <span className="text-dash-muted-foreground font-normal"> · was {label}</span> : null}
                  {assigneeLine(m.assignee)}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="daily-plan-heading">
        <h2 id="daily-plan-heading" className="text-dash-foreground mb-1 text-lg font-semibold">
          Next seven days
        </h2>
        <p className="text-dash-muted-foreground mb-5 max-w-3xl text-sm">
          Each day lists milestones with that target date; undated pending milestones are rotated across the window so
          nothing is forgotten.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {daily.map((row) => {
            const hasTargets = row.targets.length > 0;
            const hasBacklog = row.backlogSlice.length > 0;
            const quiet = !hasTargets && !hasBacklog;

            return (
              <li
                key={row.anchor.toISOString()}
                className="border-dash-border bg-dash-card flex min-h-[8rem] flex-col rounded-2xl border p-4 shadow-sm"
              >
                <p className="text-dash-foreground mb-2 text-xs font-semibold tracking-wide uppercase">{row.dayLabel}</p>
                {quiet ? (
                  <p className="text-dash-muted-foreground mt-1 text-sm">No milestones slotted.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {hasTargets ? (
                      <li>
                        <p className="text-dash-muted-foreground mb-1 text-[11px] font-medium uppercase">
                          Target date
                        </p>
                        <ul className="space-y-2">
                          {row.targets.map((m) => (
                            <li key={m.id} className="border-dash-border rounded-lg border border-dashed px-2 py-1.5">
                              <p className="text-dash-foreground font-medium leading-snug">{m.title}</p>
                              {assigneeLine(m.assignee)}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ) : null}
                    {hasBacklog ? (
                      <li>
                        <p className="text-dash-muted-foreground mb-1 text-[11px] font-medium uppercase">
                          From backlog <span className="font-normal lowercase">(add dates in Manage)</span>
                        </p>
                        <ul className="space-y-2">
                          {row.backlogSlice.map((m) => (
                            <li key={m.id} className="border-dash-border rounded-lg border border-dashed px-2 py-1.5">
                              <p className="text-dash-foreground font-medium leading-snug">{m.title}</p>
                              {assigneeLine(m.assignee)}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ) : null}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {pendingUndatedCount > 0 ? (
          <p className="text-dash-muted-foreground mt-4 max-w-3xl text-xs">
            You have undated milestones; they appear above spread across days. Edit target dates under{" "}
            <Link href={`/projects/${projectId}/work`} className="text-dash-accent font-semibold hover:underline">
              Manage → Timeline
            </Link>{" "}
            for a calendar-accurate plan.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="weekly-plan-heading">
        <h2 id="weekly-plan-heading" className="text-dash-foreground mb-1 text-lg font-semibold">
          Weekly roadmap
        </h2>
        <p className="text-dash-muted-foreground mb-5 max-w-3xl text-sm">
          Weeks are grouped from Monday–Sunday (local calendar). Only pending milestones with a target date are listed.
        </p>
        {weekly.length === 0 ? (
          <p className="text-dash-muted-foreground border-dash-border bg-dash-muted/20 rounded-2xl border border-dashed px-4 py-6 text-sm">
            No dated pending milestones yet. Add target dates on the Manage page to populate this roadmap.
          </p>
        ) : (
          <ul className="space-y-5">
            {weekly.map((w) => (
              <li key={w.weekStart.toISOString()} className="border-dash-border bg-dash-card rounded-2xl border p-5 shadow-sm">
                <h3 className="text-dash-foreground mb-3 text-base font-semibold">{w.weekHeading}</h3>
                <ul className="space-y-3">
                  {w.milestones.map((m) => {
                    const raw = m.target_date?.trim();
                    const td =
                      raw && !Number.isNaN(new Date(`${raw}T12:00:00`).getTime())
                        ? new Date(`${raw}T12:00:00`).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        : null;
                    return (
                      <li key={m.id} className="border-dash-border flex flex-col gap-0.5 border-b border-dashed pb-3 last:border-0 last:pb-0">
                        <p className="text-dash-foreground font-medium">{m.title}</p>
                        <div className="text-dash-muted-foreground flex flex-wrap gap-x-2 text-xs tabular-nums">
                          {td ? <span>Target {td}</span> : null}
                          {m.assignee?.trim() ? <span>· {m.assignee.trim()}</span> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
