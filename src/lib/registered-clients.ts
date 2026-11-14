import type { SupabaseClient } from "@supabase/supabase-js";

import { isInAcademicYear, type AcademicYearSelection } from "@/lib/academic-year";
import type { DashboardBanner, RegisteredClientRow } from "@/lib/dashboard-types";
import { syncNewInvoiceClients } from "@/lib/shop-invoices";

type RegisteredRpcRow = {
  id: string;
  name: string;
  first_seen_at: string;
  last_seen_at: string;
  phone?: string | null;
  is_hidden?: boolean | null;
  is_blocked?: boolean | null;
  blocked_reason?: string | null;
};

function mapRegisteredRpc(rows: RegisteredRpcRow[]): RegisteredClientRow[] {
  return rows
    .filter((r) => r.name?.trim())
    .map((r) => ({
      id: r.id,
      name: r.name.trim(),
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
      phone: typeof r.phone === "string" && r.phone.trim() ? r.phone.trim() : null,
      isHidden: Boolean(r.is_hidden),
      isBlocked: Boolean(r.is_blocked),
      blockedReason: typeof r.blocked_reason === "string" && r.blocked_reason.trim() ? r.blocked_reason.trim() : null,
    }));
}

/** Loads clients from registered_clients (RPC, then table as fallback). */
export async function fetchRegisteredClients(supabase: SupabaseClient): Promise<{
  clients: RegisteredClientRow[];
  hints: string[];
  source: "registry_rpc" | "registry_table" | "none";
}> {
  const hints: string[] = [];
  let source: "registry_rpc" | "registry_table" | "none" = "none";
  let clients: RegisteredClientRow[] = [];

  const sync = await syncNewInvoiceClients(supabase);
  if ("error" in sync) hints.push(sync.error);

  const rpcReg = await supabase.rpc("get_registered_clients_for_dashboard");
  if (rpcReg.error) {
    hints.push(`get_registered_clients_for_dashboard: ${rpcReg.error.message}`);
  } else if (Array.isArray(rpcReg.data)) {
    const mapped = mapRegisteredRpc(rpcReg.data as RegisteredRpcRow[]);
    if (mapped.length > 0) {
      clients = mapped;
      source = "registry_rpc";
    }
  }

  if (clients.length === 0) {
    const tbl = await supabase
      .from("registered_clients")
      .select("id, name, first_seen_at, last_seen_at, phone, is_hidden, is_blocked, blocked_reason")
      .eq("is_hidden", false)
      .eq("is_blocked", false)
      .order("last_seen_at", { ascending: false });

    if (tbl.error) {
      hints.push(`registered_clients: ${tbl.error.message}`);
    } else if (tbl.data?.length) {
      clients = (tbl.data as RegisteredRpcRow[])
        .filter((r) => r.name?.trim())
        .map((r) => ({
          id: r.id,
          name: r.name.trim(),
          firstSeenAt: r.first_seen_at,
          lastSeenAt: r.last_seen_at,
          phone: typeof r.phone === "string" && r.phone.trim() ? r.phone.trim() : null,
          isHidden: Boolean(r.is_hidden),
          isBlocked: Boolean(r.is_blocked),
          blockedReason: typeof r.blocked_reason === "string" && r.blocked_reason.trim() ? r.blocked_reason.trim() : null,
        }));
      source = "registry_table";
    }
  }

  return { clients, hints, source };
}

type ClientRecord = {
  id: string;
  name: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  phone: string | null;
  is_hidden: boolean | null;
  is_blocked: boolean | null;
  blocked_reason: string | null;
};

type InvoiceEntry = {
  client_name: string;
  title: string | null;
  issued_at: string;
};

/**
 * Clients registered from a project invoice in the selected working year.
 * A shop sale does not add a client. A name an admin deleted is not listed.
 * Titles come from the project invoice, and from a tracked project when that invoice has none.
 */
export async function fetchRegisteredClientsForYear(
  supabase: SupabaseClient,
  year: AcademicYearSelection,
  options?: { includeHidden?: boolean },
): Promise<RegisteredClientRow[]> {
  await syncNewInvoiceClients(supabase);

  let request = supabase
    .from("registered_clients")
    .select("id, name, first_seen_at, last_seen_at, phone, is_hidden, is_blocked, blocked_reason");
  if (!options?.includeHidden) {
    request = request.eq("is_hidden", false).eq("is_blocked", false);
  }
  const clientsQuery = await request;
  if (clientsQuery.error || !clientsQuery.data) return [];

  const entriesQuery = await supabase.from("invoice_client_entries").select("client_name, title, issued_at");
  const entries = entriesQuery.error ? [] : ((entriesQuery.data ?? []) as InvoiceEntry[]);
  const namesWithEntries = new Set(entries.map((entry) => entry.client_name.trim()));

  const projectsQuery = await supabase
    .from("tracked_projects")
    .select("id, title, registered_client_id, created_at");
  const projectsByClient = new Map<string, { id: string; title: string; projectId: string }[]>();
  const clientsWithProjectInYear = new Set<string>();
  for (const project of projectsQuery.data ?? []) {
    const clientId = String(project.registered_client_id ?? "");
    const title = String(project.title ?? "").trim();
    if (!clientId || !title) continue;
    const list = projectsByClient.get(clientId) ?? [];
    list.push({ id: `project:${project.id}`, title, projectId: String(project.id) });
    projectsByClient.set(clientId, list);
    if (isInAcademicYear(String(project.created_at ?? ""), year)) clientsWithProjectInYear.add(clientId);
  }

  const rows: RegisteredClientRow[] = [];
  for (const client of clientsQuery.data as ClientRecord[]) {
    const name = client.name.trim();
    if (!name) continue;
    const clientEntries = entries.filter(
      (entry) => entry.client_name.trim() === name && isInAcademicYear(entry.issued_at, year),
    );
    // Before project invoices are copied across, keep clients who already have a project in this year.
    const fromExistingProject = !namesWithEntries.has(name) && clientsWithProjectInYear.has(client.id);
    if (clientEntries.length === 0 && !fromExistingProject) continue;

    const invoiceTitles = clientEntries
      .map((entry) => entry.title?.trim())
      .filter((title): title is string => Boolean(title))
      .map((title, index) => ({ id: `invoice:${client.id}:${index}`, title }));
    const titles = invoiceTitles.length > 0 ? invoiceTitles : (projectsByClient.get(client.id) ?? []);

    rows.push({
      id: client.id,
      name,
      firstSeenAt: client.first_seen_at,
      lastSeenAt: client.last_seen_at,
      phone: client.phone,
      isHidden: Boolean(client.is_hidden),
      isBlocked: Boolean(client.is_blocked),
      blockedReason:
        typeof client.blocked_reason === "string" && client.blocked_reason.trim() ? client.blocked_reason.trim() : null,
      titles: titles.sort((a, b) => a.title.localeCompare(b.title)),
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function bannerForRegistry(params: {
  clientsLength: number;
  hints: string[];
  usingServiceRole: boolean;
}): DashboardBanner | null {
  const { clientsLength, hints, usingServiceRole } = params;

  if (clientsLength > 0) {
    return null;
  }

  if (hints.length > 0) {
    return {
      tone: "error",
      text: `Could not load registered clients. ${hints.slice(0, 2).join(" · ")}${usingServiceRole ? "" : " Tip: add SUPABASE_SERVICE_ROLE_KEY in .env.local for server reads."}`,
    };
  }

  return null;
}
