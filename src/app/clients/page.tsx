import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AddRegisteredClientForm } from "@/components/clients/add-registered-client-form";
import { RegisteredClientAdminTable } from "@/components/clients/registered-client-admin-table";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ManageRegisteredClientsPage() {
  const dash = await loadDashboardData();
  const connected = isDashboardRegistryOk(dash.banner);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  const supabase = getSupabaseAdminClient();
  let rows = dash.clients;
  let error: string | null = null;

  if (supabase) {
    const q = await supabase
      .from("registered_clients")
      .select("id, name, first_seen_at, last_seen_at, phone, is_hidden, is_blocked, blocked_reason")
      .order("last_seen_at", { ascending: false });

    if (q.error) {
      error = q.error.message;
    } else {
      rows = (q.data ?? []).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ""),
        firstSeenAt: (r.first_seen_at as string | null) ?? null,
        lastSeenAt: (r.last_seen_at as string | null) ?? null,
        phone: (r.phone as string | null) ?? null,
        isHidden: Boolean(r.is_hidden),
        isBlocked: Boolean(r.is_blocked),
        blockedReason: (r.blocked_reason as string | null) ?? null,
      }));
    }
  } else {
    error = "Database not configured.";
  }

  return (
    <DashboardShell
      title="Manage registered clients"
      subtitle="Add, hide, block, or delete clients."
      statusDotClass={statusDotClass}
    >
      <div className="mb-5">
        <p className="text-dash-muted-foreground text-sm">
          Hidden or blocked clients are excluded from dashboards and new-project client selectors.
        </p>
      </div>

      <AddRegisteredClientForm />

      {error ? (
        <div
          role="alert"
          className="border-dash-border bg-dash-card mb-6 rounded-2xl border border-amber-500/35 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">Could not load full client admin view.</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-xs">
            If a table or column is missing, run{" "}
            <code className="text-dash-foreground">supabase/v2/001_dashboard_baseline.sql</code> in the Supabase SQL
            editor.
          </p>
        </div>
      ) : null}

      <RegisteredClientAdminTable rows={rows} />

      <p className="text-dash-muted-foreground mt-8 text-center text-xs">
        <Link href="/projects" className="text-dash-accent font-medium underline-offset-2 hover:underline">
          ← All projects
        </Link>
      </p>
    </DashboardShell>
  );
}
