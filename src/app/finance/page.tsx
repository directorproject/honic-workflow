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
    paidCount: 0,
    paidPortalTsh: 0,
    paidWorkspaceTsh: 0,
    pendingCount: 0,
    pendingTotalTsh: 0,
    unpaidCount: 0,
    unpaidTotalTsh: 0,
    failedCount: 0,
    failedTotalTsh: 0,
    movementCount: 0,
    displayedCount: 0,
  };
  let error: string | null = null;
  try {
    const data = await fetchFinanceLedger(db, year);
    movements = data.movements;
    summary = data.summary;
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load finance data.";
  }

  const truncated =
    !error && summary.displayedCount < summary.movementCount
      ? `Showing latest ${summary.displayedCount.toLocaleString("en-US")} of ${summary.movementCount.toLocaleString("en-US")} movements — totals below still cover the full year.`
      : null;

  return (
    <DashboardShell
      title="Finance"
      subtitle={`All portal payments and workspace invoices in ${yearLabel}.`}
      statusDotClass={error ? "bg-amber-500" : "bg-emerald-500"}
      headerBelow={
        <Link href="/users" className="text-dash-accent text-sm font-semibold">
          ← Registered users
        </Link>
      }
    >
      <p className="text-dash-muted-foreground mb-5 text-sm">
        Records every mobile-money / simulated charge from the student portal (plans, title change, title hide,
        documents) and every workspace quote or invoice. Summary totals use the full selected year; the table lists
        individual movements.
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
          <section className="mb-6" aria-label="Overall summary">
            <h2 className="text-dash-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
              Overall summary
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card
                label="Paid total"
                value={formatTsh(summary.paidTotalTsh)}
                hint={`${summary.paidCount} paid · portal ${formatTsh(summary.paidPortalTsh)} · workspace ${formatTsh(summary.paidWorkspaceTsh)}`}
              />
              <Card
                label="Pending (mobile money)"
                value={String(summary.pendingCount)}
                hint={summary.pendingCount ? formatTsh(summary.pendingTotalTsh) : "No open prompts"}
              />
              <Card
                label="Unpaid / quotes"
                value={String(summary.unpaidCount)}
                hint={summary.unpaidCount ? formatTsh(summary.unpaidTotalTsh) : "None open"}
              />
              <Card
                label="Failed / cancelled"
                value={String(summary.failedCount)}
                hint={
                  summary.failedCount
                    ? formatTsh(summary.failedTotalTsh)
                    : `${summary.movementCount} movements in year`
                }
              />
            </div>
          </section>

          {truncated ? <p className="text-dash-muted-foreground mb-3 text-xs">{truncated}</p> : null}

          <section aria-label="Specific payment records">
            <h2 className="text-dash-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
              Specific records
            </h2>
            <FinanceLedgerTable rows={movements} />
          </section>
        </>
      )}
    </DashboardShell>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 shadow-sm">
      <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-dash-foreground mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-dash-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
