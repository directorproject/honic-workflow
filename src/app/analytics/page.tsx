import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireStaffPage } from "@/lib/portal/accounts";
import { fetchLinkClickStats, fetchTopTitleClicks } from "@/lib/portal/link-clicks";
import { fetchVisitSummary, type VisitSummary } from "@/lib/portal/page-visits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Analytics · Honic" };

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Dar_es_Salaam",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDay(dayKey: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Dar_es_Salaam",
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(new Date(`${dayKey}T12:00:00+03:00`));
  } catch {
    return dayKey;
  }
}

export default async function AnalyticsPage() {
  const db = await requireStaffPage();

  let links: Awaited<ReturnType<typeof fetchLinkClickStats>> = [];
  let titles: Awaited<ReturnType<typeof fetchTopTitleClicks>> = [];
  let visits: VisitSummary = {
    todayPageviews: 0,
    todaySessions: 0,
    last7Pageviews: 0,
    last7Sessions: 0,
    days: [],
    topPaths: [],
  };
  let error: string | null = null;
  try {
    ;[links, titles, visits] = await Promise.all([
      fetchLinkClickStats(db),
      fetchTopTitleClicks(db, 80),
      fetchVisitSummary(db, 14),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load analytics.";
  }

  const linkTotal = links.reduce((n, r) => n + r.clickCount, 0);
  const titleClickTotal = titles.reduce((n, r) => n + r.clickCount, 0);
  const titleBuyTotal = titles.reduce((n, r) => n + r.buyCount, 0);

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
      <p className="text-dash-muted-foreground mb-5 text-sm">
        First-party counts: page opens (with browser sessions), footer/WhatsApp/CTA clicks, and title opens. Days use
        Africa/Dar es Salaam. Sessions are approximate — one browser tab session per day.
      </p>

      {error ? (
        <div
          role="alert"
          className="border-dash-border bg-dash-card mb-6 rounded-2xl border border-amber-500/35 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">Could not load analytics.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <>
          <section className="mb-6" aria-label="Summary">
            <h2 className="text-dash-foreground mb-3 text-sm font-semibold tracking-wide uppercase">Summary</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Visits today"
                value={String(visits.todayPageviews)}
                hint={`${visits.todaySessions} sessions today`}
              />
              <StatCard
                label="Last 7 days"
                value={String(visits.last7Pageviews)}
                hint={`${visits.last7Sessions} sessions`}
              />
              <StatCard label="Link clicks" value={String(linkTotal)} hint={`${links.length} tracked links`} />
              <StatCard
                label="Title opens"
                value={String(titleClickTotal)}
                hint={`${titleBuyTotal} document unlocks`}
              />
            </div>
          </section>

          <section className="mb-10" aria-label="Site visits">
            <h2 className="text-dash-foreground mb-3 text-sm font-semibold tracking-wide uppercase">Site visits</h2>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="border-dash-border bg-dash-card overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-dash-border text-dash-muted-foreground border-b text-xs tracking-wide uppercase">
                      <th className="px-4 py-3 font-semibold">Day</th>
                      <th className="px-4 py-3 font-semibold tabular-nums">Pageviews</th>
                      <th className="px-4 py-3 font-semibold tabular-nums">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.days.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-dash-muted-foreground px-4 py-6 text-sm">
                          No visits recorded yet. Open the portal once after deploy.
                        </td>
                      </tr>
                    ) : (
                      visits.days.map((row) => (
                        <tr key={row.dayKey} className="border-dash-border border-b last:border-0">
                          <td className="text-dash-foreground px-4 py-2.5 font-medium">{formatDay(row.dayKey)}</td>
                          <td className="text-dash-foreground px-4 py-2.5 tabular-nums font-semibold">
                            {row.pageviewCount}
                          </td>
                          <td className="text-dash-foreground px-4 py-2.5 tabular-nums">{row.sessionCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-dash-border bg-dash-card overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-dash-border text-dash-muted-foreground border-b text-xs tracking-wide uppercase">
                      <th className="px-4 py-3 font-semibold">Top paths</th>
                      <th className="px-4 py-3 font-semibold">Day</th>
                      <th className="px-4 py-3 font-semibold tabular-nums">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.topPaths.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-dash-muted-foreground px-4 py-6 text-sm">
                          Paths will appear as people browse.
                        </td>
                      </tr>
                    ) : (
                      visits.topPaths.map((row) => (
                        <tr key={`${row.dayKey}:${row.path}`} className="border-dash-border border-b last:border-0">
                          <td className="text-dash-foreground max-w-[220px] truncate px-4 py-2.5 font-mono text-xs" title={row.path}>
                            {row.path}
                          </td>
                          <td className="text-dash-muted-foreground px-4 py-2.5 text-xs whitespace-nowrap">
                            {formatDay(row.dayKey)}
                          </td>
                          <td className="text-dash-foreground px-4 py-2.5 tabular-nums font-semibold">
                            {row.pageviewCount}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="mb-10" aria-label="Link clicks">
            <h2 className="text-dash-foreground mb-3 text-sm font-semibold tracking-wide uppercase">Clicked links</h2>
            {links.length === 0 ? (
              <p className="text-dash-muted-foreground text-sm">No link clicks recorded yet.</p>
            ) : (
              <div className="border-dash-border bg-dash-card overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-dash-border text-dash-muted-foreground border-b text-xs tracking-wide uppercase">
                      <th className="px-4 py-3 font-semibold">Label</th>
                      <th className="px-4 py-3 font-semibold">Key</th>
                      <th className="px-4 py-3 font-semibold">Destination</th>
                      <th className="px-4 py-3 font-semibold tabular-nums">Clicks</th>
                      <th className="px-4 py-3 font-semibold">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((row) => (
                      <tr key={row.linkKey} className="border-dash-border border-b last:border-0">
                        <td className="text-dash-foreground px-4 py-2.5 font-medium">{row.label}</td>
                        <td className="text-dash-muted-foreground px-4 py-2.5 font-mono text-xs">{row.linkKey}</td>
                        <td className="text-dash-muted-foreground max-w-[240px] truncate px-4 py-2.5" title={row.href}>
                          {row.href || "—"}
                        </td>
                        <td className="text-dash-foreground px-4 py-2.5 tabular-nums font-semibold">{row.clickCount}</td>
                        <td className="text-dash-muted-foreground px-4 py-2.5 whitespace-nowrap text-xs">
                          {formatWhen(row.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-label="Title engagement">
            <h2 className="text-dash-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
              Title engagement
            </h2>
            {titles.length === 0 ? (
              <p className="text-dash-muted-foreground text-sm">No title engagement recorded yet.</p>
            ) : (
              <div className="border-dash-border bg-dash-card overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-dash-border text-dash-muted-foreground border-b text-xs tracking-wide uppercase">
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Kind</th>
                      <th className="px-4 py-3 font-semibold tabular-nums">Opens</th>
                      <th className="px-4 py-3 font-semibold tabular-nums">Unlocks</th>
                      <th className="px-4 py-3 font-semibold">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titles.map((row) => (
                      <tr key={`${row.targetKind}:${row.targetId}`} className="border-dash-border border-b last:border-0">
                        <td className="text-dash-foreground max-w-[360px] px-4 py-2.5 font-medium">{row.title}</td>
                        <td className="text-dash-muted-foreground px-4 py-2.5 capitalize">{row.targetKind}</td>
                        <td className="text-dash-foreground px-4 py-2.5 tabular-nums font-semibold">{row.clickCount}</td>
                        <td className="text-dash-foreground px-4 py-2.5 tabular-nums">{row.buyCount}</td>
                        <td className="text-dash-muted-foreground px-4 py-2.5 whitespace-nowrap text-xs">
                          {formatWhen(row.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 shadow-sm">
      <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-dash-foreground mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-dash-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
