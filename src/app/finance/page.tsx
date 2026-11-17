import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { FinanceLedgerTable } from "@/components/finance/finance-ledger-table";
import { academicYearLabel } from "@/lib/academic-year";
import { getSelectedAcademicYear } from "@/lib/academic-year-server";
import { requireStaffPage } from "@/lib/portal/accounts";
import { fetchFinanceLedger } from "@/lib/staff/finance-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Finance · Honic" };

function formatTsh(n: number): string {
  return `TSh ${n.toLocaleString("en-US")}`;
}

export default async function FinancePage() {
  const db = await requireStaffPage();
  const year = await getSelectedAcademicYear();
  const yearLabel = year === "all" ? "all years" : academicYearLabel(year);

  let movements: Awaited<ReturnType<typeof fetchFinanceLedger>>["movements"] = [];
  let summary: Awaited<ReturnType<typeof fetchFinanceLedger>>["summary"] = {
    paidTotalTsh: 0,
    pendingCount: 0,
    failedCount: 0,
    movementCount: 0,
  };
  let error: string | null = null;
  try {
    const data = await fetchFinanceLedger(db, year);
    movements = data.movements;
    summary = data.summary;
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load finance data.";
  }

  return (
    <DashboardShell
      title="Finance"
      subtitle={`Portal payments and workspace invoices in ${yearLabel}.`}
      statusDotClass={error ? "bg-amber-500" : "bg-emerald-500"}
      headerBelow={
        <Link href="/users" className="text-dash-accent text-sm font-semibold">
          ← Registered users
        </Link>
      }
    >
      <p className="text-dash-muted-foreground mb-5 text-sm">
        Mobile-money rows come from <code className="text-xs">title_change_payments</code> (membership, title hide,
        documents). Workspace rows are quotes and invoices on student desks.
      </p>

      {error ? (
        <div
          role="alert"
          className="border-dash-border bg-dash-card mb-6 rounded-2xl border border-amber-500/35 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">Could not load the ledger.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Paid (visible rows)" value={formatTsh(summary.paidTotalTsh)} />
            <Card label="Movements" value={String(summary.movementCount)} />
            <Card label="Pending / unpaid" value={String(summary.pendingCount)} />
            <Card label="Failed / cancelled" value={String(summary.failedCount)} />
          </div>
          <FinanceLedgerTable rows={movements} />
        </>
      )}
    </DashboardShell>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 shadow-sm">
      <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-dash-foreground mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}