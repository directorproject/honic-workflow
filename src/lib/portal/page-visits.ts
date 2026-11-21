import type { SupabaseClient } from "@supabase/supabase-js";

export type VisitDayRow = {
  dayKey: string;
  pageviewCount: number;
  sessionCount: number;
};

export type PathVisitRow = {
  path: string;
  pageviewCount: number;
  dayKey: string;
};

export type VisitSummary = {
  todayPageviews: number;
  todaySessions: number;
  last7Pageviews: number;
  last7Sessions: number;
  days: VisitDayRow[];
  topPaths: PathVisitRow[];
};

function missingRelation(message: string): boolean {
  return /portal_visit|portal_path_visit|does not exist|schema cache/i.test(message);
}

function eatDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizePath(raw: string): string | null {
  let path = String(raw ?? "").trim();
  if (!path.startsWith("/")) path = `/${path}`;
  // Drop query/hash; keep pathname only.
  path = path.split("?")[0]?.split("#")[0] ?? path;
  if (path.length > 500) path = path.slice(0, 500);
  if (
    !path ||
    path.startsWith("/api/") ||
    path.startsWith("/_next/") ||
    path.includes(".") // static files e.g. favicon.ico
  ) {
    return null;
  }
  return path;
}

/**
 * Record a page view. Failures never throw to the browser.
 * New session_key for the EAT day bumps session_count once.
 */
export async function recordPageVisit(
  db: SupabaseClient,
  input: {
    path: string;
    sessionKey?: string | null;
    viewerId?: string | null;
  },
): Promise<void> {
  try {
    const path = normalizePath(input.path);
    if (!path) return;

    const dayKey = eatDayKey();
    const now = new Date().toISOString();
    const sessionKey = String(input.sessionKey ?? "")
      .trim()
      .slice(0, 80);
    const hasSession = sessionKey.length >= 8;

    let newSession = false;
    if (hasSession) {
      const { error: sessErr } = await db.from("portal_visit_sessions").insert({
        day_key: dayKey,
        session_key: sessionKey,
        first_path: path,
        viewer_id: input.viewerId ?? null,
      });
      if (sessErr) {
        if (missingRelation(sessErr.message)) return;
        if (!/duplicate|unique/i.test(sessErr.message)) {
          console.error("[page-visits] session", sessErr.message);
        }
      } else {
        newSession = true;
      }
    }

    const { data: dayRow } = await db
      .from("portal_visit_days")
      .select("pageview_count, session_count")
      .eq("day_key", dayKey)
      .maybeSingle();

    if (!dayRow) {
      const { error } = await db.from("portal_visit_days").insert({
        day_key: dayKey,
        pageview_count: 1,
        session_count: newSession ? 1 : 0,
        updated_at: now,
      });
      if (error) {
        if (missingRelation(error.message)) return;
        if (/duplicate|unique/i.test(error.message)) {
          await bumpDay(db, dayKey, newSession, now);
        } else {
          console.error("[page-visits] day insert", error.message);
          return;
        }
      }
    } else {
      await bumpDay(db, dayKey, newSession, now, dayRow);
    }

    const { data: pathRow } = await db
      .from("portal_path_visits")
      .select("pageview_count")
      .eq("day_key", dayKey)
      .eq("path", path)
      .maybeSingle();

    if (!pathRow) {
      const { error } = await db.from("portal_path_visits").insert({
        day_key: dayKey,
        path,
        pageview_count: 1,
        updated_at: now,
      });
      if (error) {
        if (missingRelation(error.message)) return;
        if (/duplicate|unique/i.test(error.message)) {
          const { data: again } = await db
            .from("portal_path_visits")
            .select("pageview_count")
            .eq("day_key", dayKey)
            .eq("path", path)
            .maybeSingle();
          await db
            .from("portal_path_visits")
            .update({ pageview_count: Number(again?.pageview_count ?? 0) + 1, updated_at: now })
            .eq("day_key", dayKey)
            .eq("path", path);
        }
      }
    } else {
      await db
        .from("portal_path_visits")
        .update({ pageview_count: Number(pathRow.pageview_count ?? 0) + 1, updated_at: now })
        .eq("day_key", dayKey)
        .eq("path", path);
    }
  } catch (err) {
    if (err instanceof Error && missingRelation(err.message)) return;
    console.error("[page-visits]", err);
  }
}

async function bumpDay(
  db: SupabaseClient,
  dayKey: string,
  newSession: boolean,
  now: string,
  existing?: { pageview_count?: number | null; session_count?: number | null },
) {
  const pageviews = Number(existing?.pageview_count ?? 0) + 1;
  const sessions = Number(existing?.session_count ?? 0) + (newSession ? 1 : 0);
  if (!existing) {
    const { data } = await db
      .from("portal_visit_days")
      .select("pageview_count, session_count")
      .eq("day_key", dayKey)
      .maybeSingle();
    await db
      .from("portal_visit_days")
      .update({
        pageview_count: Number(data?.pageview_count ?? 0) + 1,
        session_count: Number(data?.session_count ?? 0) + (newSession ? 1 : 0),
        updated_at: now,
      })
      .eq("day_key", dayKey);
    return;
  }
  await db
    .from("portal_visit_days")
    .update({ pageview_count: pageviews, session_count: sessions, updated_at: now })
    .eq("day_key", dayKey);
}

export async function fetchVisitSummary(db: SupabaseClient, days = 14): Promise<VisitSummary> {
  const empty: VisitSummary = {
    todayPageviews: 0,
    todaySessions: 0,
    last7Pageviews: 0,
    last7Sessions: 0,
    days: [],
    topPaths: [],
  };

  const today = eatDayKey();
  const { data: dayRows, error: dayErr } = await db
    .from("portal_visit_days")
    .select("day_key, pageview_count, session_count")
    .order("day_key", { ascending: false })
    .limit(days);
  if (dayErr) {
    if (missingRelation(dayErr.message)) return empty;
    throw new Error(dayErr.message);
  }

  const mapped: VisitDayRow[] = (dayRows ?? []).map((r) => ({
    dayKey: String(r.day_key),
    pageviewCount: Number(r.pageview_count ?? 0),
    sessionCount: Number(r.session_count ?? 0),
  }));

  const todayRow = mapped.find((d) => d.dayKey === today);
  const last7 = mapped.slice(0, 7);

  const { data: pathRows, error: pathErr } = await db
    .from("portal_path_visits")
    .select("day_key, path, pageview_count")
    .order("pageview_count", { ascending: false })
    .limit(40);
  if (pathErr) {
    if (missingRelation(pathErr.message)) return empty;
    throw new Error(pathErr.message);
  }

  // Prefer today's top paths; fall back to recent aggregate list.
  const todayPaths = (pathRows ?? [])
    .filter((r) => String(r.day_key) === today)
    .map((r) => ({
      path: String(r.path),
      pageviewCount: Number(r.pageview_count ?? 0),
      dayKey: String(r.day_key),
    }));

  const topPaths =
    todayPaths.length > 0
      ? todayPaths.slice(0, 20)
      : (pathRows ?? []).slice(0, 20).map((r) => ({
          path: String(r.path),
          pageviewCount: Number(r.pageview_count ?? 0),
          dayKey: String(r.day_key),
        }));

  return {
    todayPageviews: todayRow?.pageviewCount ?? 0,
    todaySessions: todayRow?.sessionCount ?? 0,
    last7Pageviews: last7.reduce((n, d) => n + d.pageviewCount, 0),
    last7Sessions: last7.reduce((n, d) => n + d.sessionCount, 0),
    days: mapped,
    topPaths,
  };
}
