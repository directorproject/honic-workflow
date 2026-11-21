import type { SupabaseClient } from "@supabase/supabase-js";

import {
  filterByAcademicYear,
  type AcademicYearSelection,
} from "@/lib/academic-year";
import { ensurePortalAccounts } from "@/lib/portal/accounts";
import { paymentPurposeLabel } from "@/lib/portal/payments-ledger";
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
  purposeKey: string;
  amountTsh: number;
  status: string;
  reference: string;
  provider: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
};

export type FinanceSummary = {
  /** All movements in the selected year (not just the table page). */
  movementCount: number;
  paidCount: number;
  paidTotalTsh: number;
  paidPortalTsh: number;
  paidWorkspaceTsh: number;
  pendingCount: number;
  pendingTotalTsh: number;
  unpaidCount: number;
  unpaidTotalTsh: number;
  failedCount: number;
  failedTotalTsh: number;
  /** Rows returned for the detail table. */
  displayedCount: number;
};

function purposeFromReference(reference: string, purposeCol: string | null | undefined): string {
  const col = String(purposeCol ?? "").trim().toLowerCase();
  if (col === "documents") return "project_documents";
  if (col) return col;
  const ref = reference.toUpperCase();
  if (ref.startsWith("MEMY") || ref.startsWith("MEMS") || ref.startsWith("MEM")) return "membership";
  if (ref.startsWith("HID")) return "title_hide";
  if (ref.startsWith("CHG")) return "title_change";
  if (ref.startsWith("DOC")) return "project_documents";
  if (ref.startsWith("INV")) return "invoice";
  return "other";
}

type PayRow = {
  id: string;
  user_id: string;
  amount: number | string | null;
  status: string;
  reference: string;
  provider: string | null;
  purpose: string | null;
  created_at: string;
  paid_at: string | null;
};

type InvRow = {
  id: string;
  workspace_id: string;
  description: string | null;
  amount_tsh: number | string | null;
  status: string;
  reference: string | null;
  created_at: string;
  paid_at: string | null;
  created_by: string | null;
};

async function fetchAllPortalPayments(db: SupabaseClient, year: AcademicYearSelection): Promise<PayRow[]> {
  const pageSize = 1000;
  const out: PayRow[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = db
      .from("title_change_payments")
      .select("id, user_id, amount, status, reference, provider, purpose, created_at, paid_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    query = filterByAcademicYear(query, year, "created_at");
    const { data, error } = await query;
    if (error) {
      if (/purpose|column|schema cache|does not exist/i.test(error.message)) {
        let fallback = db
          .from("title_change_payments")
          .select("id, user_id, amount, status, reference, provider, created_at, paid_at")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        fallback = filterByAcademicYear(fallback, year, "created_at");
        const second = await fallback;
        if (second.error) throw new Error(second.error.message);
        const rows = (second.data ?? []).map((r) => ({ ...r, purpose: null })) as PayRow[];
        out.push(...rows);
        if (rows.length < pageSize) break;
        continue;
      }
      throw new Error(error.message);
    }
    const rows = (data ?? []) as PayRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

async function fetchAllInvoices(db: SupabaseClient, year: AcademicYearSelection): Promise<InvRow[]> {
  const pageSize = 1000;
  const out: InvRow[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = db
      .from("portal_invoices")
      .select("id, workspace_id, description, amount_tsh, status, reference, created_at, paid_at, created_by")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    query = filterByAcademicYear(query, year, "created_at");
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as InvRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

function buildSummary(movements: FinanceMovement[], displayedCount: number): FinanceSummary {
  let paidTotalTsh = 0;
  let paidPortalTsh = 0;
  let paidWorkspaceTsh = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let pendingTotalTsh = 0;
  let unpaidCount = 0;
  let unpaidTotalTsh = 0;
  let failedCount = 0;
  let failedTotalTsh = 0;

  for (const m of movements) {
    if (m.status === "paid") {
      paidCount += 1;
      paidTotalTsh += m.amountTsh;
      if (m.channel === "portal") paidPortalTsh += m.amountTsh;
      else paidWorkspaceTsh += m.amountTsh;
    } else if (m.status === "pending") {
      pendingCount += 1;
      pendingTotalTsh += m.amountTsh;
    } else if (m.status === "unpaid" || m.status === "quote") {
      unpaidCount += 1;
      unpaidTotalTsh += m.amountTsh;
    } else if (m.status === "failed" || m.status === "cancelled") {
      failedCount += 1;
      failedTotalTsh += m.amountTsh;
    }
  }

  return {
    movementCount: movements.length,
    paidCount,
    paidTotalTsh,
    paidPortalTsh,
    paidWorkspaceTsh,
    pendingCount,
    pendingTotalTsh,
    unpaidCount,
    unpaidTotalTsh,
    failedCount,
    failedTotalTsh,
    displayedCount,
  };
}

/**
 * Staff finance ledger: every portal Snippe/simulated payment + every workspace
 * invoice/quote in the selected academic year, with an overall summary from the
 * full set (not only the table page).
 */
export async function fetchFinanceLedger(
  db: SupabaseClient,
  year: AcademicYearSelection,
  displayLimit = 1500,
): Promise<{ movements: FinanceMovement[]; summary: FinanceSummary }> {
  const [payments, invoices] = await Promise.all([
    fetchAllPortalPayments(db, year),
    fetchAllInvoices(db, year),
  ]);

  const userIds = [...new Set(payments.map((r) => String(r.user_id)))];
  const publicIds = userIds.length ? await ensurePortalAccounts(db, userIds) : new Map<string, string>();

  const [{ data: profiles }, { data: workspaces }] = await Promise.all([
    userIds.length
      ? db.from("student_profiles").select("user_id, full_name, phone").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string; phone: string }[] }),
    invoices.length
      ? db
          .from("portal_workspaces")
          .select("id, name")
          .in(
            "id",
            [...new Set(invoices.map((i) => String(i.workspace_id)))],
          )
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const nameByUser = new Map(
    (profiles ?? []).map((p) => [
      String(p.user_id),
      String(p.full_name ?? "").trim() || String(p.phone ?? "").trim(),
    ]),
  );
  const wsName = new Map((workspaces ?? []).map((w) => [String(w.id), String(w.name ?? "Workspace")]));

  const portalMoves: FinanceMovement[] = payments.map((row) => {
    const uid = String(row.user_id);
    const whenIso = String(row.paid_at ?? row.created_at);
    const purposeKey = purposeFromReference(String(row.reference), row.purpose);
    return {
      id: `pay-${row.id}`,
      when: formatDateTime(whenIso),
      whenIso,
      channel: "portal",
      userId: uid,
      userPublicId: publicIds.get(uid) ?? null,
      userLabel: nameByUser.get(uid) || uid.slice(0, 8),
      purpose: paymentPurposeLabel(purposeKey),
      purposeKey,
      amountTsh: Number(row.amount) || 0,
      status: String(row.status),
      reference: String(row.reference),
      provider: row.provider ? String(row.provider) : null,
      workspaceId: null,
      workspaceName: null,
    };
  });

  const invoiceMoves: FinanceMovement[] = invoices.map((row) => {
    const wsId = String(row.workspace_id);
    const whenIso = String(row.paid_at ?? row.created_at);
    const desc = String(row.description ?? "").trim();
    return {
      id: `inv-${row.id}`,
      when: formatDateTime(whenIso),
      whenIso,
      channel: "workspace" as const,
      userId: row.created_by ? String(row.created_by) : null,
      userPublicId: null,
      userLabel: wsName.get(wsId) ?? "Workspace",
      purpose: desc || "Workspace invoice",
      purposeKey: "invoice",
      amountTsh: Number(row.amount_tsh) || 0,
      status: String(row.status),
      reference: row.reference ? String(row.reference) : `invoice-${String(row.id).slice(0, 8)}`,
      provider: null,
      workspaceId: wsId,
      workspaceName: wsName.get(wsId) ?? null,
    };
  });

  const creatorIds = [
    ...new Set(invoiceMoves.map((m) => m.userId).filter((id): id is string => Boolean(id))),
  ];
  if (creatorIds.length) {
    const creatorPublic = await ensurePortalAccounts(db, creatorIds);
    for (const move of invoiceMoves) {
      if (move.userId) move.userPublicId = creatorPublic.get(move.userId) ?? null;
    }
  }

  const allMovements = [...portalMoves, ...invoiceMoves].sort((a, b) => b.whenIso.localeCompare(a.whenIso));
  const movements = allMovements.slice(0, displayLimit);
  const summary = buildSummary(allMovements, movements.length);

  return { movements, summary };
}
