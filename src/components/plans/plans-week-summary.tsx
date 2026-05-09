export function PlansWeekSummary({
  weekHeading,
  startIso,
  endIso,
  total,
  pending,
  inProgress,
  blocked,
  overdueCalendar,
}: {
  weekHeading: string;
  startIso: string;
  endIso: string;
  total: number;
  pending: number;
  inProgress: number;
  blocked: number;
  overdueCalendar: number;
}) {
  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 shadow-sm sm:px-5">
      <p className="text-dash-foreground text-sm font-semibold tracking-tight">Weekly snapshot · {weekHeading}</p>
      <p className="text-dash-muted-foreground mt-1 font-mono text-[11px] tabular-nums">
        {startIso} → {endIso}
      </p>
      <dl className="text-dash-muted-foreground mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="border-dash-border bg-dash-muted/25 rounded-xl border px-3 py-2">
          <dt className="font-semibold uppercase tracking-wide opacity-80">Open milestones</dt>
          <dd className="text-dash-foreground mt-0.5 text-lg font-bold tabular-nums">{total}</dd>
        </div>
        <div className="border-dash-border bg-dash-muted/25 rounded-xl border px-3 py-2">
          <dt className="font-semibold uppercase tracking-wide opacity-80">Pending</dt>
          <dd className="text-dash-foreground mt-0.5 text-lg font-bold tabular-nums">{pending}</dd>
        </div>
        <div className="border-dash-border bg-dash-muted/25 rounded-xl border px-3 py-2">
          <dt className="font-semibold uppercase tracking-wide opacity-80">In progress</dt>
          <dd className="text-dash-foreground mt-0.5 text-lg font-bold tabular-nums">{inProgress}</dd>
        </div>
        <div className="border-dash-border bg-dash-muted/25 rounded-xl border px-3 py-2">
          <dt className="font-semibold uppercase tracking-wide opacity-80">Blocked</dt>
          <dd className="text-dash-foreground mt-0.5 text-lg font-bold tabular-nums">{blocked}</dd>
        </div>
        <div className="border-dash-border border-amber-500/35 bg-amber-500/10 rounded-xl px-3 py-2 dark:bg-amber-500/5">
          <dt className="font-semibold uppercase tracking-wide text-amber-900 opacity-90 dark:text-amber-100">
            Calendar overdue
          </dt>
          <dd className="text-dash-foreground mt-0.5 text-lg font-bold tabular-nums">{overdueCalendar}</dd>
        </div>
      </dl>
      <p className="text-dash-muted-foreground mt-3 text-[11px] leading-snug">
        Workflow labels match what you set under <span className="text-dash-foreground font-medium">Manage → Timeline</span>.
        Calendar overdue counts rows whose deadline is before today (among rows listed below).
      </p>
    </div>
  );
}
