import Link from "next/link";

import type { PlansMilestoneRow } from "@/lib/next-week-milestones-data";

function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function MilestoneCardBody({ m }: { m: PlansMilestoneRow }) {
  return (
    <div className="hover:bg-dash-muted/30 px-5 py-4 transition-colors">
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4">
        <p className="text-dash-foreground min-w-0 flex-1 font-medium leading-snug">{m.title}</p>
        <div className="text-dash-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-medium">{m.clientName ?? "Client"}</span>
          <span className="hidden sm:inline">·</span>
          <Link
            href={`/projects/${m.projectId}`}
            className="text-dash-accent hover:text-dash-accent-dim font-semibold underline-offset-2 hover:underline"
          >
            {m.projectTitle}
          </Link>
        </div>
      </div>
      {m.assignee?.trim() ? (
        <p className="text-dash-muted-foreground mt-2 text-xs">
          Assigned to <span className="text-dash-foreground font-medium">{m.assignee.trim()}</span>
        </p>
      ) : null}
      <p className="mt-2">
        <Link
          href={`/projects/${m.projectId}/work`}
          className="text-dash-accent text-xs font-semibold underline-offset-2 hover:underline"
        >
          Manage this project →
        </Link>
      </p>
    </div>
  );
}

export function PlansMilestonesView({
  thisWeek,
  overdue,
  weekHeading,
  weekMonday,
}: {
  thisWeek: PlansMilestoneRow[];
  overdue: PlansMilestoneRow[];
  weekHeading: string;
  weekMonday: Date;
}) {
  const byDay = new Map<string, PlansMilestoneRow[]>();
  for (const m of thisWeek) {
    const list = byDay.get(m.target_date) ?? [];
    list.push(m);
    byDay.set(m.target_date, list);
  }

  const days: { iso: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    days.push({ iso: `${y}-${mo}-${da}` });
  }

  const nothingScheduled = thisWeek.length === 0 && overdue.length === 0;

  return (
    <div className="space-y-8">
      <header className="border-dash-border bg-dash-card rounded-2xl border p-5 shadow-sm sm:p-6">
        <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">Week of {weekHeading}</h2>
        <p className="text-dash-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Pending milestones with a target date in this calendar week (Monday–Sunday, local time), across every project,
          plus overdue items whose target date has passed. Completed milestones are hidden. Edit dates on each
          project&apos;s Manage page.
        </p>
      </header>

      {overdue.length > 0 ? (
        <section
          aria-labelledby="overdue-milestones-heading"
          className="border-amber-500/40 bg-amber-500/10 rounded-2xl border px-4 py-4 sm:px-5"
        >
          <h3 id="overdue-milestones-heading" className="text-dash-foreground text-base font-semibold">
            Overdue targets ({overdue.length})
          </h3>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            Still pending with a target date before today — reschedule or complete them under Manage → Timeline.
          </p>
          <ul className="divide-dash-border mt-4 divide-y overflow-hidden rounded-xl border border-amber-500/25 bg-dash-card/80">
            {overdue.map((m) => (
              <li key={m.milestoneId}>
                <p className="text-dash-muted-foreground bg-dash-muted/20 px-5 pt-3 pb-1 text-[11px] font-medium uppercase tabular-nums">
                  Target{" "}
                  {new Date(`${m.target_date}T12:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <MilestoneCardBody m={m} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nothingScheduled ? (
        <div className="border-dash-border bg-dash-muted/20 text-dash-muted-foreground rounded-2xl border border-dashed px-6 py-14 text-center text-sm">
          No dated pending milestones for this week and nothing overdue. Add target dates under{" "}
          <span className="text-dash-foreground font-medium">Manage → Timeline</span> on any project.
        </div>
      ) : thisWeek.length === 0 ? (
        <div className="border-dash-border bg-dash-muted/20 text-dash-muted-foreground rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
          No pending milestones have targets in this calendar week. Overdue items still appear above when present.
        </div>
      ) : (
        <div className="space-y-6">
          {days.map(({ iso }) => {
            const rows = byDay.get(iso);
            if (!rows?.length) return null;
            return (
              <section key={iso} aria-labelledby={`day-${iso}`} className="border-dash-border bg-dash-card rounded-2xl border shadow-sm">
                <h3 id={`day-${iso}`} className="border-dash-border text-dash-foreground border-b px-5 py-3 text-base font-semibold">
                  {dayLabel(iso)}
                </h3>
                <ul className="divide-dash-border divide-y">
                  {rows.map((m) => (
                    <li key={m.milestoneId}>
                      <MilestoneCardBody m={m} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
