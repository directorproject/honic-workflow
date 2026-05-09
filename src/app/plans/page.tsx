import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PlansMilestonesView } from "@/components/plans/next-week-milestones-view";
import { PlansWeekCalendarJump } from "@/components/plans/plans-week-calendar-jump";
import { PlansWeekSummary } from "@/components/plans/plans-week-summary";
import { PlansWeekNav } from "@/components/plans/plans-week-nav";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { clampWeekOffset, loadPlansBoardData, type PlansMilestoneRow } from "@/lib/next-week-milestones-data";
import { buildPlansUrl } from "@/lib/plans-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function summarizeWeekly(rows: PlansMilestoneRow[], todayIso: string) {
  let pending = 0;
  let inProgress = 0;
  let blocked = 0;
  let overdueCalendar = 0;
  for (const m of rows) {
    if (m.work_status === "pending") pending += 1;
    else if (m.work_status === "in_progress") inProgress += 1;
    else if (m.work_status === "blocked") blocked += 1;
    if (m.target_date < todayIso) overdueCalendar += 1;
  }
  return { total: rows.length, pending, inProgress, blocked, overdueCalendar };
}

export default async function PlansPage(props: {
  searchParams?: Promise<{ client?: string; week?: string }>;
}) {
  const sp = props.searchParams ? await props.searchParams : {};
  const clientFilter = typeof sp.client === "string" ? sp.client.trim() : "";
  const weekOffset = clampWeekOffset(Number.parseInt(String(sp.week ?? ""), 10));

  const dash = await loadDashboardData();
  const { inWeek, overdue, weekHeading, startIso, endIso, todayIso, weekMonday, error } = await loadPlansBoardData({
    registeredClientId: clientFilter || undefined,
    weekOffset,
  });

  const connected = isDashboardRegistryOk(dash.banner);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  const filteredClientName =
    clientFilter && dash.clients.find((c) => c.id === clientFilter)?.name;

  const rowsCombined = [...overdue, ...inWeek];
  const summary = summarizeWeekly(rowsCombined, todayIso);

  const shellTitle = weekOffset === 0 ? "This week — milestones" : "Week view — milestones";
  const shellSubtitle =
    "Weekly snapshot below · browse weeks or jump from the calendar · workflow is edited under Manage → Timeline.";

  return (
    <DashboardShell title={shellTitle} subtitle={shellSubtitle} statusDotClass={statusDotClass}>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-stretch gap-3 lg:flex-nowrap lg:items-end">
          <div className="shrink-0">
            <PlansWeekNav weekOffset={weekOffset} clientFilter={clientFilter} />
          </div>
          <div className="min-w-0 flex-1">
            <PlansWeekCalendarJump clientFilter={clientFilter} weekMondayIso={startIso} />
          </div>
        </div>

        <PlansWeekSummary
          weekHeading={weekHeading}
          startIso={startIso}
          endIso={endIso}
          total={summary.total}
          pending={summary.pending}
          inProgress={summary.inProgress}
          blocked={summary.blocked}
          overdueCalendar={summary.overdueCalendar}
        />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <form action="/plans" method="get" className="flex flex-wrap items-end gap-3">
            {weekOffset !== 0 ? <input type="hidden" name="week" value={String(weekOffset)} /> : null}
            <div>
              <label htmlFor="plans-client" className="text-dash-muted-foreground mb-1 block text-xs font-medium">
                Filter by client
              </label>
              <select
                id="plans-client"
                name="client"
                defaultValue={clientFilter}
                className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 min-w-[12rem] rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
              >
                <option value="">All clients</option>
                {dash.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            >
              Apply
            </button>
          </form>
          <div className="text-dash-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <Link href="/projects" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
              All projects
            </Link>
            <Link href="/" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
              Home
            </Link>
          </div>
        </div>
      </div>

      {clientFilter ? (
        <p className="text-dash-muted-foreground mb-4 text-sm">
          Showing milestones for{" "}
          <span className="text-dash-foreground font-semibold">{filteredClientName ?? "selected client"}</span>
          {" · "}
          <Link href={buildPlansUrl({ week: weekOffset })} className="text-dash-accent font-medium underline-offset-2 hover:underline">
            Clear client filter
          </Link>
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="border-dash-border bg-dash-card mb-6 rounded-2xl border border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          <p className="font-medium">Could not load milestones.</p>
          <p className="mt-1 opacity-90">{error}</p>
          <p className="text-dash-muted-foreground mt-2 text-xs">
            If this mentions <code className="text-dash-foreground">work_status</code>, run{" "}
            <code className="text-dash-foreground">supabase/018_project_milestones_work_status.sql</code> in Supabase.
          </p>
        </div>
      ) : (
        <>
          <p className="text-dash-muted-foreground mb-6 text-xs tabular-nums">
            Week <span className="text-dash-foreground font-medium">{startIso}</span>
            {" → "}
            <span className="text-dash-foreground font-medium">{endIso}</span>
            {" · "}today <span className="text-dash-foreground font-medium">{todayIso}</span>
            {" · offset "}
            <span className="text-dash-foreground font-medium">{weekOffset}</span>
            {" · "}
            <span className="text-dash-foreground font-medium">{summary.total}</span> open in table (
            {inWeek.length} in range
            {weekOffset === 0 && overdue.length > 0 ? ` · ${overdue.length} overdue list` : ""})
          </p>
          <PlansMilestonesView
            inWeek={inWeek}
            overdue={overdue}
            weekHeading={weekHeading}
            weekMonday={weekMonday}
            todayIso={todayIso}
            weekOffset={weekOffset}
          />
        </>
      )}

      <p className="text-dash-muted-foreground mt-10 text-center text-xs">
        <Link href="/projects" className="text-dash-accent font-medium underline-offset-2 hover:underline">
          ← All projects
        </Link>
      </p>
    </DashboardShell>
  );
}
