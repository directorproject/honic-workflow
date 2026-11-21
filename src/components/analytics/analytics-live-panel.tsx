"use client";

import { useCallback, useEffect, useState } from "react";

import type { LinkClickRow, TitleClickAdminRow } from "@/lib/portal/link-clicks";
import type { VisitSummary } from "@/lib/portal/page-visits";

const POLL_MS = 5000;

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
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatAgo(iso: string | null, nowMs: number): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const ms = Math.max(0, nowMs - t);
  if (ms < 12_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
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

function displayPath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function pageLabel(path: string): string {
  const p = displayPath(path);
  if (p === "/" || p === "/portal") return "Student portal home";
  if (p === "/portal/home") return "My home";
  if (p === "/portal/titles") return "Literature / titles list";
  if (p === "/portal/titles/mine" || p.startsWith("/portal/titles/mine/")) return "My titles";
  if (p.startsWith("/portal/titles/")) return "Title detail";
  if (p === "/portal/packs") return "Plans & access";
  if (p === "/portal/jobs") return "Peer help";
  if (p.startsWith("/portal/jobs/")) return "Peer help detail";
  if (p === "/portal/zimamoto" || p.startsWith("/portal/zimamoto/")) return "Zimamoto";
  if (p === "/about") return "About Honic";
  if (p === "/share-portal") return "Share portal info";
  if (p === "/login") return "Staff login";
  if (p.startsWith("/analytics")) return "Analytics";
  if (p.startsWith("/users")) return "Registered users";
  if (p.startsWith("/finance")) return "Finance";
  if (p.startsWith("/students")) return "Student workspaces";
  if (p.startsWith("/titles")) return "Staff titles";
  return p;
}

export type AnalyticsLivePayload = {
  visits: VisitSummary;
  links: LinkClickRow[];
  titles: TitleClickAdminRow[];
  error?: string | null;
};

export function AnalyticsLivePanel({ initial }: { initial: AnalyticsLivePayload }) {
  const [data, setData] = useState(initial);
  const [fetchedAt, setFetchedAt] = useState(() => new Date().toISOString());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [live, setLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/staff/analytics-summary", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        visits?: VisitSummary;
        links?: LinkClickRow[];
        titles?: TitleClickAdminRow[];
        fetchedAt?: string;
        error?: string;
      };
      if (json.error || !json.visits) return;
      setData({
        visits: json.visits,
        links: json.links ?? [],
        titles: json.titles ?? [],
        error: null,
      });
      setFetchedAt(json.fetchedAt ?? new Date().toISOString());
      setLive(true);
    } catch {
      setLive(false);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const { visits, links, titles, error } = data;
  const pages = visits.pages?.length ? visits.pages : visits.topPaths;
  const maxPageViews = Math.max(1, ...pages.map((p) => p.pageviewCount));
  const linkTotal = links.reduce((n, r) => n + r.clickCount, 0);
  const titleClickTotal = titles.reduce((n, r) => n + r.clickCount, 0);
  const titleBuyTotal = titles.reduce((n, r) => n + r.buyCount, 0);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-dash-muted-foreground text-sm">
          First-party counts: each page people open, footer/WhatsApp/CTA clicks, and title opens. Days use Africa/Dar es
          Salaam. A signed-in person counts once per title per day; opening your own owned title is not counted.
        </p>
        <p className="text-dash-muted-foreground inline-flex items-center gap-2 text-xs whitespace-nowrap">
          <span
            className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"} ${refreshing ? "animate-pulse" : ""}`}
            aria-hidden
          />
          {live ? "Live" : "Paused"}
          <span className="text-dash-muted-foreground/80">·</span>
          <span title={formatWhen(fetchedAt)}>Updated {formatAgo(fetchedAt, nowMs)}</span>
          {visits.lastActivityAt ? (
            <>
              <span className="text-dash-muted-foreground/80">·</span>
              <span title={formatWhen(visits.lastActivityAt)}>
                Last open {formatAgo(visits.lastActivityAt, nowMs)}
              </span>
            </>
          ) : null}
        </p>
      </div>

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
          <section className="mb-10 space-y-4" aria-label="Summary">
            <h2 className="text-dash-foreground text-sm font-semibold tracking-wide uppercase">Summary</h2>
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
              <StatCard label="Pages tracked" value={String(pages.length)} hint="Open below when you want the list" />
              <StatCard
                label="Title opens"
                value={String(titleClickTotal)}
                hint={`${titleBuyTotal} document unlocks · ${linkTotal} link clicks`}
              />
            </div>

            <details className="border-dash-border bg-dash-card group rounded-2xl border" open>
              <summary className="text-dash-foreground flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold sm:px-5 [&::-webkit-details-marker]:hidden">
                <span>
                  Pages visited
                  <span className="text-dash-muted-foreground ml-2 font-normal">
                    {pages.length === 0 ? "— none yet" : `· ${pages.length} pages`}
                  </span>
                </span>
                <span className="border-dash-border text-dash-muted-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="border-dash-border border-t">
                {pages.length === 0 ? (
                  <p className="text-dash-muted-foreground px-4 py-6 text-sm sm:px-5">
                    No page visits yet. Browse the portal — this list updates live.
                  </p>
                ) : (
                  <ul className="divide-dash-border divide-y">
                    {pages.map((row) => {
                      const pct = Math.round((row.pageviewCount / maxPageViews) * 100);
                      const pathShown = displayPath(row.path);
                      const label = pageLabel(row.path);
                      const showPath = label !== pathShown;
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
                                <p
                                  className="text-dash-muted-foreground mt-0.5 truncate font-mono text-[11px]"
                                  title={pathShown}
                                >
                                  {pathShown}
                                </p>
                              ) : null}
                              <p
                                className="text-dash-muted-foreground mt-1 text-[11px]"
                                title={row.lastSeenAt ? formatWhen(row.lastSeenAt) : undefined}
                              >
                                Last opened{" "}
                                <span className="text-dash-foreground font-medium">
                                  {formatAgo(row.lastSeenAt, nowMs)}
                                </span>
                                {row.lastSeenAt ? (
                                  <span className="text-dash-muted-foreground/80"> · {formatWhen(row.lastSeenAt)}</span>
                                ) : (
                                  <span> · {formatDay(row.lastSeenDay)}</span>
                                )}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs sm:gap-5">
                              <CountChip label="Today" value={row.todayCount} />
                              <CountChip label="7 days" value={row.last7Count} />
                              <CountChip label="30 days" value={row.pageviewCount} strong />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </details>

            <details className="border-dash-border bg-dash-card group rounded-2xl border">
              <summary className="text-dash-foreground flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold sm:px-5 [&::-webkit-details-marker]:hidden">
                <span>
                  Daily totals
                  <span className="text-dash-muted-foreground ml-2 font-normal">
                    {visits.days.length === 0 ? "— none yet" : `· ${visits.days.length} days`}
                  </span>
                </span>
                <span className="border-dash-border text-dash-muted-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="border-dash-border overflow-x-auto border-t">
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
            </details>
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
                        <td className="text-dash-muted-foreground px-4 py-2.5 whitespace-nowrap text-xs" title={formatWhen(row.updatedAt)}>
                          {formatAgo(row.updatedAt, nowMs)}
                          <span className="mt-0.5 block opacity-70">{formatWhen(row.updatedAt)}</span>
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
                        <td className="text-dash-muted-foreground px-4 py-2.5 whitespace-nowrap text-xs" title={formatWhen(row.updatedAt)}>
                          {formatAgo(row.updatedAt, nowMs)}
                          <span className="mt-0.5 block opacity-70">{formatWhen(row.updatedAt)}</span>
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
    </>
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
