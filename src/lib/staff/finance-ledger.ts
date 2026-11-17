import type { SupabaseClient } from "@supabase/supabase-js";

import { isInAcademicYear, type AcademicYearSelection } from "@/lib/academic-year";
import { ensurePortalAccounts } from "@/lib/portal/accounts";
import { formatDateTime } from "@/lib/workspace/dates";

export type FinanceMovement = {
  id: string;
  when: string;
  whenIso: string;
  channel: "portal" | "workspace";
  userLabel: string;
  userPublicId: string | null;
  userId: string | null;
  purpose: string;
  amountTsh: number;
  status: string;
  reference: string;
  provider: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
};

export type FinanceSummary = {
  paidTotalTsh: number;
  pendingCount: number;
  failedCount: number;
  movementCount: number;
};

function purposeLabel(raw: string | null): string {
  switch (raw) {
    case "membership":
      return "Nexis Desk membership";
    case "title_hide":
      return "Title hide";
    case "title_change":
      return "Title change";
    case "documents":
      return "Literature documents";
    default:
      return raw?.trim() || "Portal payment";
  }
}

export async function fetchFinanceLedger(
  db: SupabaseClient,
  year: AcademicYearSelection,
  limit = 400,
): Promise<{ movements: FinanceMovement[]; summary: FinanceSummary }> {
  const [{ data: payments, error: payErr }, { data: invoices, error: invErr }] = await Promise.all([
    db
      .from("title_change_payments")
      .select("id, user_id, amount, status, reference, provider, purpose, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(limit * 2),
    db
      .from("portal_invoices")
      .select("id, workspace_id, description, amount_tsh, status, reference, created_at, paid_at, created_by")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);
  if (payErr) throw new Error(payErr.message);
  if (invErr) throw new Error(invErr.message);

  const inYear = (iso: string) => year === "all" || isInAcademicYear(iso, year);
  const payRows = (payments ?? []).filter((row) => inYear(String(row.created_at)));

  const userIds = [...new Set(payRows.map((r) => String(r.user_id)))];
  const publicIds = userIds.length ? await ensurePortalAccounts(db, userIds) : new Map<string, string>();

  const [{ data: profiles }, { data: workspaces }] = await Promise.all([
    userIds.length
      ? db.from("student_profiles").select("user_id, full_name, phone").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string; phone: string }[] }),
    (invoices ?? []).length
      ? db
          .from("portal_workspaces")
          .select("id, name")
          .in(
            "id",
            [...new Set((invoices ?? []).map((i) => String(i.workspace_id)))],
          )
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const nameByUser = new Map(
    (profiles ?? []).map((p) => [String(p.user_id), String(p.full_name ?? "").trim() || String(p.phone ?? "").trim()]),
  );

  const wsName = new Map((workspaces ?? []).map((w) => [String(w.id), String(w.name ?? "Workspace")]));

  const portalMoves: FinanceMovement[] = payRows.map((row) => {
    const uid = String(row.user_id);
    const whenIso = String(row.paid_at ?? row.created_at);
    return {
      id: `pay-${row.id}`,
      when: formatDateTime(whenIso),
      whenIso,
      channel: "portal",
      userId: uid,
      userPublicId: publicIds.get(uid) ?? null,
      userLabel: nameByUser.get(uid) || uid.slice(0, 8),
      purpose: purposeLabel(row.purpose ? String(row.purpose) : null),
      amountTsh: Number(row.amount) || 0,
      status: String(row.status),
      reference: String(row.reference),
      provider: row.provider ? String(row.provider) : null,
      workspaceId: null,
      workspaceName: null,
    };
  });

  const invoiceMoves: FinanceMovement[] = (invoices ?? [])
    .filter((row) => inYear(String(row.created_at)))
    .map((row) => {
      const wsId = String(row.workspace_id);
      const whenIso = String(row.paid_at ?? row.created_at);
      return {
        id: `inv-${row.id}`,
        when: formatDateTime(whenIso),
        whenIso,
        channel: "workspace",
        userId: row.created_by ? String(row.created_by) : null,
        userPublicId: null,
        userLabel: wsName.get(wsId) ?? "Workspace",
        purpose: String(row.description ?? "Workspace invoice"),
        amountTsh: Number(row.amount_tsh) || 0,
        status: String(row.status),
        reference: row.reference ? String(row.reference) : `invoice-${String(row.id).slice(0, 8)}`,
        provider: null,
        workspaceId: wsId,
        workspaceName: wsName.get(wsId) ?? null,
      };
    });

  // Resolve public ids for invoice creators when present
  const creatorIds = [...new Set(invoiceMoves.map((m) => m.userId).filter((id): id is string => Boolean(id)))];
  if (creatorIds.length) {
    const creatorPublic = await ensurePortalAccounts(db, creatorIds);
    for (const move of invoiceMoves) {
      if (move.userId) move.userPublicId = creatorPublic.get(move.userId) ?? null;
    }
  }

  const movements = [...portalMoves, ...invoiceMoves]
    .sort((a, b) => b.whenIso.localeCompare(a.whenIso))
    .slice(0, limit);

  const summary: FinanceSummary = {
    movementCount: movements.length,
    paidTotalTsh: movements.filter((m) => m.status === "paid").reduce((sum, m) => sum + m.amountTsh, 0),
    pendingCount: movements.filter((m) => m.status === "pending" || m.status === "unpaid").length,
    failedCount: movements.filter((m) => m.status === "failed" || m.status === "cancelled").length,
  };

  return { movements, summary };
}
