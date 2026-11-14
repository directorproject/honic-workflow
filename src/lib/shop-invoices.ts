import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

/**
 * The shop project is where invoices are written. The dashboard reads new project invoices
 * and adds that client name. Shop sales are ignored. Names an admin has removed are not added again.
 */
export function getShopSupabaseClient(): SupabaseClient | null {
  const url = process.env.SHOP_SUPABASE_URL?.trim();
  const key = process.env.SHOP_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
let lastSyncAt = 0;

type ShopInvoice = {
  id: string;
  invoice_number: string | null;
  client_name: string | null;
  issue_date: string | null;
  created_at: string;
  payload: unknown;
};

function cleanName(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
}

const KIND_KEYS = [
  "type",
  "kind",
  "category",
  "invoiceType",
  "invoice_type",
  "document_type",
  "documentType",
  "mode",
  "template",
  "source",
];

/** True only for a project invoice. Shop sales and invoices with no project marker stay out. */
export function isClientRegisteringInvoice(payload: unknown, invoiceNumber?: string | null): boolean {
  if (typeof invoiceNumber === "string" && /(project|proj|prj)/i.test(invoiceNumber)) return true;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (!/project/i.test(key)) continue;
    if (value === true) return true;
    if (typeof value === "number") return true;
    if (typeof value === "string" && value.trim()) return true;
  }
  const kind = KIND_KEYS.map((key) => record[key])
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return kind.includes("project");
}

export function invoiceTitleFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["title", "projectTitle", "project_title", "subject"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 300);
  }
  const items = record.items ?? record.lineItems ?? record.lines;
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const text = row.title ?? row.name ?? row.description;
    if (typeof text === "string" && text.trim()) return text.trim().slice(0, 300);
  }
  return null;
}

function issuedAt(row: ShopInvoice): string {
  if (row.issue_date) return `${row.issue_date}T12:00:00+03:00`;
  return row.created_at;
}

/**
 * Pull shop invoices written after the saved bookmark and add any new client.
 * Safe to call often: it waits five minutes between runs and does nothing when the shop key is unset.
 */
export async function syncNewInvoiceClients(
  dashboard: SupabaseClient,
): Promise<{ added: number } | { skipped: true } | { error: string }> {
  const shop = getShopSupabaseClient();
  if (!shop) return { skipped: true };
  if (Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return { skipped: true };
  lastSyncAt = Date.now();

  const state = await dashboard
    .from("invoice_sync_state")
    .select("watermark")
    .eq("id", "shop_invoices")
    .maybeSingle();
  if (state.error) return { error: state.error.message };
  const watermark = String(state.data?.watermark ?? "2026-11-01T00:00:00+03:00");

  const removed = await dashboard.from("registered_client_removals").select("name");
  if (removed.error) return { error: removed.error.message };
  const removedNames = new Set((removed.data ?? []).map((row) => cleanName(row.name)));

  let added = 0;
  let pageWatermark = watermark;
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await shop
      .from("invoices")
      .select("id, invoice_number, client_name, issue_date, created_at, payload")
      .gt("created_at", pageWatermark)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(500);
    if (error) return { error: `shop invoices: ${error.message}` };
    const rows = (data ?? []) as ShopInvoice[];
    if (rows.length === 0) break;

    const ids = rows.map((row) => row.id);
    const known = await dashboard.from("invoice_client_entries").select("shop_invoice_id").in("shop_invoice_id", ids);
    if (known.error) return { error: known.error.message };
    const knownIds = new Set((known.data ?? []).map((row) => String(row.shop_invoice_id)));

    for (const row of rows) {
      if (knownIds.has(row.id) || !isClientRegisteringInvoice(row.payload, row.invoice_number)) continue;
      const name = cleanName(row.client_name);
      if (!name || removedNames.has(name)) continue;
      const issued = issuedAt(row);
      const title = invoiceTitleFromPayload(row.payload);

      const existing = await dashboard.from("registered_clients").select("id").eq("name", name).maybeSingle();
      if (existing.error) return { error: existing.error.message };
      if (!existing.data) {
        const inserted = await dashboard.from("registered_clients").insert({
          name,
          first_seen_at: issued,
          last_seen_at: issued,
        });
        if (inserted.error && inserted.error.code !== "23505") return { error: inserted.error.message };
        if (!inserted.error) added += 1;
      } else {
        await dashboard.from("registered_clients").update({ last_seen_at: issued }).eq("name", name).lt("last_seen_at", issued);
      }

      const entry = await dashboard.from("invoice_client_entries").upsert(
        { shop_invoice_id: row.id, client_name: name, title, issued_at: issued },
        { onConflict: "shop_invoice_id" },
      );
      if (entry.error) return { error: entry.error.message };
    }

    const last = rows[rows.length - 1];
    pageWatermark = last.created_at;
    const saved = await dashboard
      .from("invoice_sync_state")
      .upsert({ id: "shop_invoices", watermark: pageWatermark }, { onConflict: "id" });
    if (saved.error) return { error: saved.error.message };
    if (rows.length < 500) break;
  }

  return { added };
}
