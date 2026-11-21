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

/** Short human label for common portal paths. */
function pageLabel(path: string): string {
  if (path === "/" || path === "/portal") return "Student portal home";
  if (path === "/portal/home") return "My home";
  if (path === "/portal/titles") return "Literature / titles list";
  if (path.startsWith("/portal/titles/")) return "Title detail";
  if (path === "/portal/packs") return "Plans & access";
  if (path === "/portal/jobs") return "Peer help";
  if (path.startsWith("/portal/jobs/")) return "Peer help detail";
  if (path === "/about") return "About Honic";
  if (path === "/share-portal") return "Share portal info";
  if (path === "/login") return "Staff login";
  if (path.startsWith("/analytics")) return "Analytics";
  if (path.startsWith("/users")) return "Registered users";
  if (path.startsWith("/finance")) return "Finance";
  if (path.startsWith("/students")) return "Student workspaces";
  if (path.startsWith("/titles")) return "Staff titles";
  return path;
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

  const pages = visits.pages?.length ? visits.pages : visits.topPaths;
  const maxPageViews = Math.max(1, ...pages.map((p) => p.pageviewCount));
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
        First-party counts: each page people open, footer/WhatsApp/CTA clicks, and title opens. Days use Africa/Dar es
        Salaam. A signed-in person counts once per title per day; opening your own owned title is not counted.
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
              <StatCard label="Pages tracked" value={String(pages.length)} hint="Distinct paths in last 30 days" />
              <StatCard
                label="Title opens"
                value={String(titleClickTotal)}
                hint={`${titleBuyTotal} document unlocks · ${linkTotal} link clicks`}
              />
            </div>
          </section>

          <section className="mb-10" aria-label="Pages visited">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-dash-foreground text-sm font-semibold tracking-wide uppercase">Pages visited</h2>
                <p className="text-dash-muted-foreground mt-1 text-xs">
                  Every path opened in the last 30 days, with today and 7-day counts.
                </p>
              </div>
              <p className="text-dash-muted-foreground text-xs tabular-nums">{pages.length} pages</p>
            </div>

            {pages.length === 0 ? (
              <p className="text-dash-muted-foreground border-dash-border bg-dash-card rounded-2xl border px-4 py-8 text-sm">
                No page visits yet. Browse the portal after deploy, then refresh this page.
              </p>
            ) : (
              <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border">
                <ul className="divide-dash-border divide-y">
                  {pages.map((row) => {
                    const pct = Math.round((row.pageviewCount / maxPageViews) * 100);
                    const label = pageLabel(row.path);
                    const showPath = label !== row.path;
                    return (
                      <li key={row.path} className="relative px-4 py-3 sm:px-5">
                        <div
                          className="bg-dash-accent/10 pointer-events-none absolute inset-y-0 left-0"
                          style={{ width: `${pct}%` }}
                          aria-hidden
                        />
                        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-dash-foreground text-sm font-semibold">{label}</p>
                            {showPath ? (
                              <p className="text-dash-muted-foreground mt-0.5 truncate font-mono text-[11px]" title={row.path}>
                                {row.path}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs sm:gap-5">
                            <CountChip label="Today" value={row.todayCount} />
                            <CountChip label="7 days" value={row.last7Count} />
                            <CountChip label="30 days" value={row.pageviewCount} strong />
                            <span className="text-dash-muted-foreground hidden whitespace-nowrap sm:inline">
                              Last {formatDay(row.lastSeenDay)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <section className="mb-10" aria-label="Daily visits">
            <h2 className="text-dash-foreground mb-3 text-sm font-semibold tracking-wide uppercase">Daily totals</h2>
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
                        No daily totals yet.
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

function CountChip({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-dash-muted-foreground text-[10px] font-semibold tracking-wide uppercase">{label}</p>
      <p
        className={`tabular-nums ${strong ? "text-dash-foreground text-base font-semibold" : "text-dash-foreground text-sm font-medium"}`}
      >
        {value}
      </p>
    </div>
  );
}
