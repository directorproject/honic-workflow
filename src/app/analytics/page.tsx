import Link from "next/link";

import { AnalyticsLivePanel } from "@/components/analytics/analytics-live-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireStaffPage } from "@/lib/portal/accounts";
import { fetchLinkClickStats, fetchTopTitleClicks } from "@/lib/portal/link-clicks";
import { fetchVisitSummary, type VisitSummary } from "@/lib/portal/page-visits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Analytics · Honic" };

export default async function AnalyticsPage() {
  const db = await requireStaffPage();

  let links: Awaited<ReturnType<typeof fetchLinkClickStats>> = [];
  let titles: Awaited<ReturnType<typeof fetchTopTitleClicks>> = [];
  let visits: VisitSummary = {
    todayPageviews: 0,
    todaySessions: 0,
    last7Pageviews: 0,
    last7Sessions: 0,
    lastActivityAt: null,
    days: [],
    topPaths: [],
    pages: [],
  };
  let error: string | null = null;
  try {
    ;[links, titles, visits] = await Promise.all([
      fetchLinkClickStats(db),
      fetchTopTitleClicks(db, 80),
      fetchVisitSummary(db, 30),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load analytics.";
  }

  return (
    <DashboardShell
      title="Analytics"
      subtitle="Visits, link clicks, and title engagement from the portal."
      statusDotClass={error ? "bg-amber-500" : "bg-emerald-500"}
      headerBelow={
        <Link href="/users" className="text-dash-accent text-sm font-semibold">
          ← Registered users
        </Link>
      }
    >
      <AnalyticsLivePanel initial={{ visits, links, titles, error }} />
    </DashboardShell>
  );
}
