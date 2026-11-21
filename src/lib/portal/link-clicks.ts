import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkClickRow = {
  linkKey: string;
  label: string;
  href: string;
  clickCount: number;
  updatedAt: string | null;
};

export type TitleClickAdminRow = {
  targetKind: string;
  targetId: string;
  title: string;
  clickCount: number;
  buyCount: number;
  updatedAt: string | null;
};

function missingRelation(message: string): boolean {
  return /portal_link_click|portal_title_engagement|does not exist|schema cache/i.test(message);
}

function eatDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Record a CTA / outbound link click. Failures never throw to the browser.
 * Signed-in viewers count once per link per calendar day (EAT).
 */
export async function recordLinkClick(
  db: SupabaseClient,
  input: {
    linkKey: string;
    label?: string;
    href?: string;
    viewerId?: string | null;
    sourcePath?: string | null;
  },
): Promise<void> {
  try {
    const linkKey = String(input.linkKey ?? "")
      .trim()
      .slice(0, 120);
    if (!linkKey) return;

    const label = String(input.label ?? linkKey).trim().slice(0, 200);
    const href = String(input.href ?? "").trim().slice(0, 2000);
    const dayKey = eatDayKey();
    const now = new Date().toISOString();

    const { error: insErr } = await db.from("portal_link_clicks").insert({
      link_key: linkKey,
      label,
      href,
      click_count: 0,
      updated_at: now,
    });
    if (insErr) {
      if (missingRelation(insErr.message)) return;
      if (!/duplicate|unique/i.test(insErr.message)) {
        console.error("[link-clicks] ensure row", insErr.message);
        return;
      }
    }
    await db.from("portal_link_clicks").update({ label, href, updated_at: now }).eq("link_key", linkKey);

    const { error: evErr } = await db.from("portal_link_click_events").insert({
      link_key: linkKey,
      viewer_id: input.viewerId ?? null,
      source_path: input.sourcePath ? String(input.sourcePath).slice(0, 500) : null,
      day_key: dayKey,
    });
    if (evErr) {
      if (missingRelation(evErr.message)) return;
      if (/duplicate|unique/i.test(evErr.message)) return;
      throw new Error(evErr.message);
    }

    const { data: row } = await db
      .from("portal_link_clicks")
      .select("click_count")
      .eq("link_key", linkKey)
      .maybeSingle();
    const next = Number(row?.click_count ?? 0) + 1;
    await db
      .from("portal_link_clicks")
      .update({ click_count: next, updated_at: now })
      .eq("link_key", linkKey);
  } catch (err) {
    if (err instanceof Error && missingRelation(err.message)) return;
    console.error("[link-clicks]", err);
  }
}

export async function fetchLinkClickStats(db: SupabaseClient): Promise<LinkClickRow[]> {
  const { data, error } = await db
    .from("portal_link_clicks")
    .select("link_key, label, href, click_count, updated_at")
    .order("click_count", { ascending: false })
    .limit(200);
  if (error) {
    if (missingRelation(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    linkKey: String(row.link_key),
    label: String(row.label ?? row.link_key),
    href: String(row.href ?? ""),
    clickCount: Number(row.click_count ?? 0),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }));
}

export async function fetchTopTitleClicks(db: SupabaseClient, limit = 50): Promise<TitleClickAdminRow[]> {
  const { data, error } = await db
    .from("portal_title_engagement")
    .select("target_kind, target_id, click_count, buy_count, updated_at")
    .order("click_count", { ascending: false })
    .limit(limit);
  if (error) {
    if (missingRelation(error.message)) return [];
    throw new Error(error.message);
  }

  const proposalIds = (data ?? []).filter((r) => r.target_kind === "proposal").map((r) => String(r.target_id));
  const earlierIds = (data ?? []).filter((r) => r.target_kind === "earlier").map((r) => String(r.target_id));

  const titleById = new Map<string, string>();
  if (proposalIds.length) {
    const { data: titles } = await db.from("title_proposals").select("id, title").in("id", proposalIds);
    for (const t of titles ?? []) titleById.set(`proposal:${t.id}`, String(t.title ?? ""));
  }
  if (earlierIds.length) {
    const { data: titles } = await db.from("last_year_projects").select("id, title").in("id", earlierIds);
    for (const t of titles ?? []) titleById.set(`earlier:${t.id}`, String(t.title ?? ""));
  }

  return (data ?? []).map((row) => {
    const kind = String(row.target_kind);
    const id = String(row.target_id);
    return {
      targetKind: kind,
      targetId: id,
      title: titleById.get(`${kind}:${id}`) || `${kind} · ${id.slice(0, 8)}`,
      clickCount: Number(row.click_count ?? 0),
      buyCount: Number(row.buy_count ?? 0),
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    };
  });
}
