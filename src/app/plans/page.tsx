import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PlansMilestonesView } from "@/components/plans/next-week-milestones-view";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { loadThisWeekAndOverdueMilestones } from "@/lib/next-week-milestones-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PlansPage(props: {
  searchParams?: Promise<{ client?: string }>;
}) {
  const sp = props.searchParams ? await props.searchParams : {};
  const clientFilter = typeof sp.client === "string" ? sp.client.trim() : "";

  const dash = await loadDashboardData();
  const { thisWeek, overdue, weekHeading, startIso, endIso, todayIso, weekMonday, error } =
    await loadThisWeekAndOverdueMilestones(clientFilter || undefined);

  const connected = isDashboardRegistryOk(dash.banner);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  const filteredClientName =
    clientFilter && dash.clients.find((c) => c.id === clientFilter)?.name;

  const totalListed = thisWeek.length + overdue.length;

  return (
    <DashboardShell
      title="This week — milestones"
      subtitle="Timeline targets in the current calendar week (and overdue), across all projects."
      statusDotClass={statusDotClass}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <form action="/plans" method="get" className="flex flex-wrap items-end gap-3">
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

      {clientFilter ? (
        <p className="text-dash-muted-foreground mb-4 text-sm">
          Showing milestones for{" "}
          <span className="text-dash-foreground font-semibold">{filteredClientName ?? "selected client"}</span>
          {" · "}
          <Link href="/plans" className="text-dash-accent font-medium underline-offset-2 hover:underline">
            Clear filter
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
        </div>
      ) : (
        <>
          <p className="text-dash-muted-foreground mb-6 text-xs tabular-nums">
            Week <span className="text-dash-foreground font-medium">{startIso}</span>
            {" → "}
            <span className="text-dash-foreground font-medium">{endIso}</span>
            {" · "}today <span className="text-dash-foreground font-medium">{todayIso}</span>
            {" · "}
            <span className="text-dash-foreground font-medium">{totalListed}</span> listed{" "}
            <span className="opacity-80">
              ({thisWeek.length} this week
              {overdue.length > 0 ? ` · ${overdue.length} overdue` : ""})
            </span>
          </p>
          <PlansMilestonesView
            thisWeek={thisWeek}
            overdue={overdue}
            weekHeading={weekHeading}
            weekMonday={weekMonday}
            todayIso={todayIso}
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
