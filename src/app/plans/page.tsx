import Link from "next/link";

import { PlansMilestonesView } from "@/components/plans/next-week-milestones-view";
import { PlansWeekCalendarJump } from "@/components/plans/plans-week-calendar-jump";
import { PlansWeekSummary } from "@/components/plans/plans-week-summary";
import { PlansWeekNav } from "@/components/plans/plans-week-nav";
import { NexisWordmark } from "@/components/brand/nexis-wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SiteFooter } from "@/components/portal/site-footer";
import { academicYearLabel } from "@/lib/academic-year";
import { getSelectedAcademicYear } from "@/lib/academic-year-server";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { clampWeekOffset, loadPlansBoardData, type PlansMilestoneRow } from "@/lib/next-week-milestones-data";
import { buildPlansUrl } from "@/lib/plans-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function summarizeWeekly(rows: PlansMilestoneRow[], todayIso: string) {
  let done = 0;
  let pending = 0;
  let inProgress = 0;
  let blocked = 0;
  let overdueCalendar = 0;
  for (const m of rows) {
    if (m.work_status === "done") done += 1;
    else if (m.work_status === "pending") pending += 1;
    else if (m.work_status === "in_progress") inProgress += 1;
    else if (m.work_status === "blocked") blocked += 1;
    if (m.target_date < todayIso) overdueCalendar += 1;
  }
  return { total: rows.length, done, pending, inProgress, blocked, overdueCalendar };
}

export default async function PlansPage(props: {
  searchParams?: Promise<{ client?: string; week?: string }>;
}) {
  const sp = props.searchParams ? await props.searchParams : {};
  const clientFilter = typeof sp.client === "string" ? sp.client.trim() : "";
  const weekOffset = clampWeekOffset(Number.parseInt(String(sp.week ?? ""), 10));

  const year = await getSelectedAcademicYear();
  const yearLabel = year === "all" ? "all years" : academicYearLabel(year);
  const dash = await loadDashboardData();
  const { rows, weekHeading, startIso, endIso, todayIso, weekMonday, error } = await loadPlansBoardData({
    registeredClientId: clientFilter || undefined,
    weekOffset,
    year,
  });

  const connected = isDashboardRegistryOk(dash.banner);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  const filteredClientName =
    clientFilter && dash.clients.find((c) => c.id === clientFilter)?.name;

  const summary = summarizeWeekly(rows, todayIso);

  const shellTitle = weekOffset === 0 ? "This week — milestones" : "Week view — milestones";
  const shellSubtitle =
    `Projects in ${yearLabel}. Browse weeks or jump from the calendar. Workflow is edited under Manage → Timeline.`;

  return (
    <div className="bg-dash-canvas text-dash-foreground min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-dash-border/50 bg-dash-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <NexisWordmark />
            <h1 className="text-lg font-bold">Project timeline</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Title and description */}
          <div className="mb-8">
            <p className="text-dash-muted-foreground text-sm mb-1">
              {connected ? (
                <span className={`inline-block h-2 w-2 rounded-full ${statusDotClass} mr-2`} />
              ) : null}
              Milestones in {yearLabel}. Week {startIso} to {endIso}.
            </p>
          </div>

          {/* Controls */}
          <div className="bg-dash-card border border-dash-border/50 rounded-2xl p-5 mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[12rem]">
                  <PlansWeekNav weekOffset={weekOffset} clientFilter={clientFilter} />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <PlansWeekCalendarJump clientFilter={clientFilter} weekMondayIso={startIso} />
                </div>
              </div>

              <form action="/plans" method="get" className="flex flex-wrap items-end gap-3">
                {weekOffset !== 0 ? <input type="hidden" name="week" value={String(weekOffset)} /> : null}
                <div>
                  <label htmlFor="plans-client" className="text-dash-muted-foreground mb-2 block text-xs font-medium">
                    Filter by client
                  </label>
                  <select
                    id="plans-client"
                    name="client"
                    defaultValue={clientFilter}
                    className="border border-dash-border/50 bg-dash-canvas text-dash-foreground focus:ring-dash-accent/25 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
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
                  className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                >
                  Apply
                </button>
              </form>
            </div>
          </div>

          {/* Summary card */}
          <div className="mb-6">
            <PlansWeekSummary
              weekHeading={weekHeading}
              startIso={startIso}
              endIso={endIso}
              total={summary.total}
              done={summary.done}
              pending={summary.pending}
              inProgress={summary.inProgress}
              blocked={summary.blocked}
              overdueCalendar={summary.overdueCalendar}
            />
          </div>

          {/* Client filter notice */}
          {clientFilter ? (
            <div className="bg-dash-card border border-dash-border/50 rounded-lg px-4 py-3 mb-6 text-sm">
              <span className="text-dash-foreground font-medium">Filtered:</span>{" "}
              <span className="text-dash-muted-foreground">
                {filteredClientName ?? "selected client"}
              </span>
              {" · "}
              <Link
                href={buildPlansUrl({ week: weekOffset })}
                className="text-dash-accent font-medium hover:underline"
              >
                Clear filter
              </Link>
            </div>
          ) : null}

          {/* Error state */}
          {error ? (
            <div
              role="alert"
              className="border border-red-500/30 bg-red-500/5 rounded-xl px-5 py-4 mb-6"
            >
              <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Could not load milestones</p>
              <p className="text-sm text-red-600 dark:text-red-400 opacity-90">{error}</p>
            </div>
          ) : null}

          {/* Milestones table */}
          {!error && (
            <div className="bg-dash-card border border-dash-border/50 rounded-2xl overflow-hidden">
              <PlansMilestonesView rows={rows} weekHeading={weekHeading} weekMonday={weekMonday} todayIso={todayIso} />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
