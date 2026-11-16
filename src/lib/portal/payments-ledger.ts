import type { SupabaseClient } from "@supabase/supabase-js";

import { defaultPendingExpiresAt, isPendingExpired } from "@/lib/payments/pending-expiry";

export type PortalPaymentRow = {
  id: string;
  reference: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "expired" | string;
  network: string | null;
  phone: string | null;
  provider: string | null;
  purpose: string;
  purposeLabel: string;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
};

function purposeFromReference(reference: string, purposeCol: string | null | undefined): string {
  const col = String(purposeCol ?? "").trim().toLowerCase();
  if (col) return col;
  const ref = reference.toUpperCase();
  if (ref.startsWith("MEMY") || ref.startsWith("MEMS") || ref.startsWith("MEM")) return "membership";
  if (ref.startsWith("HID")) return "title_hide";
  if (ref.startsWith("CHG")) return "title_change";
  if (ref.startsWith("DOC")) return "project_documents";
  return "other";
}

export function paymentPurposeLabel(purpose: string): string {
  switch (purpose) {
    case "membership":
      return "Nexis Desk plan";
    case "title_hide":
      return "Title hide (make yours)";
    case "title_change":
      return "Title change";
    case "project_documents":
      return "Project documents unlock";
    default:
      return "Portal payment";
  }
}

function mapRow(row: Record<string, unknown>): PortalPaymentRow {
  const purpose = purposeFromReference(String(row.reference), row.purpose ? String(row.purpose) : null);
  const createdAt = String(row.created_at);
  const expiresAt =
    row.expires_at != null
      ? String(row.expires_at)
      : String(row.status) === "pending"
        ? defaultPendingExpiresAt(new Date(createdAt))
        : null;
  const rawStatus = String(row.status);
  const status =
    rawStatus === "pending" && isPendingExpired({ status: rawStatus, expiresAt, createdAt })
      ? "expired"
      : rawStatus;
  return {
    id: String(row.id),
    reference: String(row.reference),
    amount: Number(row.amount) || 0,
    status,
    network: row.network ? String(row.network) : null,
    phone: row.phone ? String(row.phone) : null,
    provider: row.provider ? String(row.provider) : null,
    purpose,
    purposeLabel: paymentPurposeLabel(purpose),
    createdAt,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    expiresAt,
  };
}

export async function listPaymentsForUser(db: SupabaseClient, userId: string): Promise<PortalPaymentRow[]> {
  const { data, error } = await db
    .from("title_change_payments")
    .select("id, reference, amount, status, network, phone, provider, purpose, created_at, paid_at, expires_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (/purpose|expires_at|column|schema cache|does not exist/i.test(error.message)) {
      const fallback = await db
        .from("title_change_payments")
        .select("id, reference, amount, status, network, phone, provider, created_at, paid_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (fallback.error) throw new Error(fallback.error.message);
      return (fallback.data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    }
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}
