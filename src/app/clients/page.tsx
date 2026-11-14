import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AddRegisteredClientForm } from "@/components/clients/add-registered-client-form";
import { RegisteredClientAdminTable } from "@/components/clients/registered-client-admin-table";
import { academicYearLabel } from "@/lib/academic-year";
import { getSelectedAcademicYear } from "@/lib/academic-year-server";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { fetchRegisteredClientsForYear } from "@/lib/registered-clients";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ManageRegisteredClientsPage() {
  const year = await getSelectedAcademicYear();
  const yearLabel = year === "all" ? "all years" : academicYearLabel(year);
  const dash = await loadDashboardData();
  const connected = isDashboardRegistryOk(dash.banner);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  const supabase = getSupabaseAdminClient();
  const rows = supabase ? await fetchRegisteredClientsForYear(supabase, year, { includeHidden: true }) : [];
  const error = supabase ? null : "Database not configured.";

  return (
    <DashboardShell
      title="Manage registered clients"
      subtitle={`Project-invoice clients in ${yearLabel}. Add, hide, block, or delete.`}
      statusDotClass={statusDotClass}
    >
      <div className="mb-5">
        <p className="text-dash-muted-foreground text-sm">
          Shop sales are not listed. Hidden or blocked clients stay here so you can change them, and stay off the other pages.
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
