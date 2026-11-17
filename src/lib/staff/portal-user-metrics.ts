import type { SupabaseClient } from "@supabase/supabase-js";

import { planModeLabel } from "@/lib/portal/title-limits";

export type UserPortalMetrics = {
  planLabel: string;
  deskPlan: string | null;
  deskExpiresAt: string | null;
  shortlistCount: number;
  heldTitleId: string | null;
  heldTitleName: string | null;
  claimsTotal: number;
  claimsPending: number;
  jobsPosted: number;
  jobPublicIds: string[];
  groupsCreated: number;
  groupPublicIds: string[];
  paidTotalTsh: number;
  paymentCount: number;
  paidPaymentCount: number;
};

const EMPTY: UserPortalMetrics = {
  planLabel: "—",
  deskPlan: null,
  deskExpiresAt: null,
  shortlistCount: 0,
  heldTitleId: null,
  heldTitleName: null,
  claimsTotal: 0,
  claimsPending: 0,
  jobsPosted: 0,
  jobPublicIds: [],
  groupsCreated: 0,
  groupPublicIds: [],
  paidTotalTsh: 0,
  paymentCount: 0,
  paidPaymentCount: 0,
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type ProfilePlan = { user_id: string; desk_plan: string | null; desk_expires_at: string | null };

/** Batch portal stats for staff user tables (service-role client). */
export async function loadPortalUserMetrics(
  db: SupabaseClient,
  userIds: string[],
  profilePlans: ProfilePlan[],
): Promise<Map<string, UserPortalMetrics>> {
  const map = new Map<string, UserPortalMetrics>();
  for (const id of userIds) {
    map.set(id, { ...EMPTY });
  }
  if (!userIds.length) return map;

  const planByUser = new Map(profilePlans.map((p) => [String(p.user_id), p]));

  for (const id of userIds) {
    const plan = planByUser.get(id);
    const label = plan
      ? planModeLabel({ deskExpiresAt: plan.desk_expires_at, deskPlan: plan.desk_plan }).title
      : "No profile";
    const row = map.get(id)!;
    row.deskPlan = plan?.desk_plan ?? null;
    row.deskExpiresAt = plan?.desk_expires_at ?? null;
    row.planLabel = label;
  }

  for (const ids of chunk(userIds, 80)) {
    const [
      { data: shortlist },
      { data: held },
      { data: claims },
      { data: jobs },
      { data: groups },
      { data: payments },
    ] = await Promise.all([
      db.from("title_selections").select("user_id").in("user_id", ids).is("released_at", null),
      db.from("title_proposals").select("id, title, selected_by").in("selected_by", ids),
      db.from("portal_title_claims").select("requester_id, status").in("requester_id", ids),
      db.from("portal_jobs").select("poster_user_id, public_id").in("poster_user_id", ids),
      db.from("zimamoto_groups").select("owner_user_id, public_id").in("owner_user_id", ids),
      db.from("title_change_payments").select("user_id, amount, status").in("user_id", ids),
    ]);

    const shortlistCount = new Map<string, number>();
    for (const row of shortlist ?? []) {
      const uid = String(row.user_id);
      shortlistCount.set(uid, (shortlistCount.get(uid) ?? 0) + 1);
    }
    for (const [uid, count] of shortlistCount) {
      const m = map.get(uid);
      if (m) m.shortlistCount = count;
    }

    for (const row of held ?? []) {
      const uid = String(row.selected_by);
      const m = map.get(uid);
      if (m) {
        m.heldTitleId = String(row.id);
        m.heldTitleName = String(row.title ?? "");
      }
    }

    const claimTotals = new Map<string, { total: number; pending: number }>();
    for (const row of claims ?? []) {
      const uid = String(row.requester_id);
      const cur = claimTotals.get(uid) ?? { total: 0, pending: 0 };
      cur.total += 1;
      if (String(row.status) === "pending") cur.pending += 1;
      claimTotals.set(uid, cur);
    }
    for (const [uid, c] of claimTotals) {
      const m = map.get(uid);
      if (m) {
        m.claimsTotal = c.total;
        m.claimsPending = c.pending;
      }
    }

    const jobsByUser = new Map<string, string[]>();
    for (const row of jobs ?? []) {
      const uid = String(row.poster_user_id);
      const list = jobsByUser.get(uid) ?? [];
      list.push(String(row.public_id));
      jobsByUser.set(uid, list);
    }
    for (const [uid, list] of jobsByUser) {
      const m = map.get(uid);
      if (m) {
        m.jobsPosted = list.length;
        m.jobPublicIds = list;
      }
    }

    const groupsByUser = new Map<string, string[]>();
    for (const row of groups ?? []) {
      const uid = String(row.owner_user_id);
      const list = groupsByUser.get(uid) ?? [];
      list.push(String(row.public_id));
      groupsByUser.set(uid, list);
    }
    for (const [uid, list] of groupsByUser) {
      const m = map.get(uid);
      if (m) {
        m.groupsCreated = list.length;
        m.groupPublicIds = list;
      }
    }

    for (const row of payments ?? []) {
      const uid = String(row.user_id);
      const m = map.get(uid);
      if (!m) continue;
      m.paymentCount += 1;
      if (String(row.status) === "paid") {
        m.paidPaymentCount += 1;
        m.paidTotalTsh += Number(row.amount) || 0;
      }
    }
  }

  return map;
}

export type UserJobRow = {
  id: string;
  publicId: string;
  title: string;
  status: string;
  offerTsh: number;
  createdAt: string;
};

export type UserGroupRow = {
  publicId: string;
  name: string;
  createdAt: string;
};

export type UserPaymentRow = {
  id: string;
  reference: string;
  purpose: string | null;
  amount: number;
  status: string;
  provider: string;
  createdAt: string;
  paidAt: string | null;
};

export async function loadUserPortalDetailMetrics(
  db: SupabaseClient,
  userId: string,
): Promise<{
  jobs: UserJobRow[];
  groups: UserGroupRow[];
  payments: UserPaymentRow[];
  shortlistCount: number;
  deskPlan: string | null;
  deskExpiresAt: string | null;
  planLabel: string;
}> {
  const [{ data: profile }, { data: shortlist }, jobsQ, groupsQ, paymentsQ] = await Promise.all([
    db.from("student_profiles").select("desk_plan, desk_expires_at").eq("user_id", userId).maybeSingle(),
    db.from("title_selections").select("id").eq("user_id", userId).is("released_at", null),
    db
      .from("portal_jobs")
      .select("id, public_id, title, status, offer_tsh, created_at")
      .eq("poster_user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("zimamoto_groups")
      .select("public_id, name, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("title_change_payments")
      .select("id, reference, purpose, amount, status, provider, created_at, paid_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const deskPlan = profile?.desk_plan ? String(profile.desk_plan) : null;
  const deskExpiresAt = profile?.desk_expires_at ? String(profile.desk_expires_at) : null;

  return {
    deskPlan,
    deskExpiresAt,
    planLabel: profile
      ? planModeLabel({ deskExpiresAt, deskPlan }).title
      : "No profile",
    shortlistCount: shortlist?.length ?? 0,
    jobs: (jobsQ.data ?? []).map((row) => ({
      id: String(row.id),
      publicId: String(row.public_id),
      title: String(row.title),
      status: String(row.status),
      offerTsh: Number(row.offer_tsh) || 0,
      createdAt: String(row.created_at),
    })),
    groups: (groupsQ.data ?? []).map((row) => ({
      publicId: String(row.public_id),
      name: String(row.name),
      createdAt: String(row.created_at),
    })),
    payments: (paymentsQ.data ?? []).map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      purpose: row.purpose ? String(row.purpose) : null,
      amount: Number(row.amount) || 0,
      status: String(row.status),
      provider: String(row.provider),
      createdAt: String(row.created_at),
      paidAt: row.paid_at ? String(row.paid_at) : null,
    })),
  };
}