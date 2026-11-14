import type { SupabaseClient } from "@supabase/supabase-js";

import type { TitleTargetKind } from "@/lib/portal/title-claims";

export type TitleEngagement = {
  targetKind: TitleTargetKind;
  targetId: string;
  clickCount: number;
  buyCount: number;
};

function missingRelation(message: string): boolean {
  return /portal_title_engagement|does not exist|schema cache/i.test(message);
}

export function engagementKey(kind: TitleTargetKind, id: string): string {
  return `${kind}:${id}`;
}

export async function engagementForTargets(
  db: SupabaseClient,
  targets: { kind: TitleTargetKind; id: string }[],
): Promise<Map<string, TitleEngagement>> {
  const map = new Map<string, TitleEngagement>();
  if (!targets.length) return map;

  const proposalIds = targets.filter((t) => t.kind === "proposal").map((t) => t.id);
  const earlierIds = targets.filter((t) => t.kind === "earlier").map((t) => t.id);

  const loads = await Promise.all([
    proposalIds.length
      ? db.from("portal_title_engagement").select("target_kind, target_id, click_count, buy_count").eq("target_kind", "proposal").in("target_id", proposalIds)
      : Promise.resolve({ data: [], error: null }),
    earlierIds.length
      ? db.from("portal_title_engagement").select("target_kind, target_id, click_count, buy_count").eq("target_kind", "earlier").in("target_id", earlierIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const res of loads) {
    if (res.error) {
      if (missingRelation(res.error.message)) return map;
      throw new Error(res.error.message);
    }
    for (const row of res.data ?? []) {
      const kind = String(row.target_kind) as TitleTargetKind;
      const id = String(row.target_id);
      map.set(engagementKey(kind, id), {
        targetKind: kind,
        targetId: id,
        clickCount: Number(row.click_count ?? 0),
        buyCount: Number(row.buy_count ?? 0),
      });
    }
  }

  for (const t of targets) {
    const key = engagementKey(t.kind, t.id);
    if (!map.has(key)) {
      map.set(key, { targetKind: t.kind, targetId: t.id, clickCount: 0, buyCount: 0 });
    }
  }
  return map;
}

async function bumpCount(
  db: SupabaseClient,
  targetKind: TitleTargetKind,
  targetId: string,
  field: "click_count" | "buy_count",
): Promise<void> {
  const read = async () =>
    db
      .from("portal_title_engagement")
      .select("click_count, buy_count")
      .eq("target_kind", targetKind)
      .eq("target_id", targetId)
      .maybeSingle();

  let { data: existing, error: readErr } = await read();
  if (readErr) throw new Error(readErr.message);

  if (!existing) {
    const { error } = await db.from("portal_title_engagement").insert({
      target_kind: targetKind,
      target_id: targetId,
      click_count: field === "click_count" ? 1 : 0,
      buy_count: field === "buy_count" ? 1 : 0,
      updated_at: new Date().toISOString(),
    });
    if (!error) return;
    if (!/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    ({ data: existing, error: readErr } = await read());
    if (readErr) throw new Error(readErr.message);
    if (!existing) return;
  }

  const nextClick = Number(existing.click_count ?? 0) + (field === "click_count" ? 1 : 0);
  const nextBuy = Number(existing.buy_count ?? 0) + (field === "buy_count" ? 1 : 0);
  const { error: upErr } = await db
    .from("portal_title_engagement")
    .update({
      click_count: nextClick,
      buy_count: nextBuy,
      updated_at: new Date().toISOString(),
    })
    .eq("target_kind", targetKind)
    .eq("target_id", targetId);
  if (upErr) throw new Error(upErr.message);
}

/**
 * Count a title open. Confirmed owner and staff are not counted.
 * Same viewer counts at most once per calendar day (EAT).
 */
export async function recordTitleClick(
  db: SupabaseClient,
  input: {
    targetKind: TitleTargetKind;
    targetId: string;
    viewerId: string | null;
    ownerId: string | null;
    isStaff?: boolean;
  },
): Promise<void> {
  try {
    if (input.isStaff) return;
    if (input.viewerId && input.ownerId && input.viewerId === input.ownerId) return;

    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Dar_es_Salaam",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const { error: evErr } = await db.from("portal_title_engagement_events").insert({
      target_kind: input.targetKind,
      target_id: input.targetId,
      kind: "click",
      viewer_id: input.viewerId,
      day_key: dayKey,
    });
    if (evErr) {
      if (missingRelation(evErr.message)) return;
      if (/duplicate|unique/i.test(evErr.message)) return;
      throw new Error(evErr.message);
    }
    await bumpCount(db, input.targetKind, input.targetId, "click_count");
  } catch (err) {
    if (err instanceof Error && missingRelation(err.message)) return;
    // Engagement must never break opening a title.
    console.error("[title-engagement] click", err);
  }
}

/**
 * Count a document buy/open for a title. Owner and staff are not counted.
 * Same viewer + document counts once.
 */
export async function recordTitleDocumentBuy(
  db: SupabaseClient,
  input: {
    targetKind: TitleTargetKind;
    targetId: string;
    documentId: string;
    viewerId: string | null;
    ownerId: string | null;
    isStaff?: boolean;
  },
): Promise<void> {
  try {
    if (input.isStaff) return;
    if (input.viewerId && input.ownerId && input.viewerId === input.ownerId) return;

    const { error: evErr } = await db.from("portal_title_engagement_events").insert({
      target_kind: input.targetKind,
      target_id: input.targetId,
      kind: "buy",
      viewer_id: input.viewerId,
      document_id: input.documentId,
    });
    if (evErr) {
      if (missingRelation(evErr.message)) return;
      if (/duplicate|unique/i.test(evErr.message)) return;
      throw new Error(evErr.message);
    }
    await bumpCount(db, input.targetKind, input.targetId, "buy_count");
  } catch (err) {
    if (err instanceof Error && missingRelation(err.message)) return;
    console.error("[title-engagement] buy", err);
  }
}
