import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StudentsTable, type SummaryRow } from "@/components/workspace/students-table";
import { academicYearLabel, isInAcademicYear } from "@/lib/academic-year";
import { getSelectedAcademicYear } from "@/lib/academic-year-server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { diffDays, todayIso } from "@/lib/workspace/dates";
import { loadWorkspaceSummaries } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Student workspaces · Honic" };

export default async function StudentsPage() {
  const year = await getSelectedAcademicYear();
  const yearLabel = year === "all" ? "all years" : academicYearLabel(year);
  const db = getSupabaseAdminClient();
  const summaries = (db ? await loadWorkspaceSummaries(db) : []).filter((s) => isInAcademicYear(s.startedAt, year));
  const today = todayIso();
  const rows: SummaryRow[] = summaries.map((s) => {
    const risk: string[] = [];
    if (s.health.state === "behind") risk.push("Behind plan");
    if (s.health.overdue.length >= 3) risk.push(`${s.health.overdue.length} late tasks`);
    const idle = diffDays(today, s.lastActivityAt.slice(0, 10));
    if (idle >= 14) risk.push(`Inactive ${idle} days`);
    return { ...s, risk };
  });
  const count = (f: (r: SummaryRow) => number) => rows.reduce((n, r) => n + f(r), 0);

  return (
    <DashboardShell title="Student workspaces" subtitle={`Plans, progress and requests in ${yearLabel}. Invoices here are for these projects.`} statusDotClass="bg-emerald-500">
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Workspaces" value={rows.length} />
        <Card label="At risk" value={rows.filter((r) => r.risk.length).length} tone="text-rose-600 dark:text-rose-300" />
        <Link href="/students/help-desk" className="block">
          <Card label="Help desk unread" value={count((r) => r.unreadMessages)} tone="text-rose-600 dark:text-rose-300" />
        </Link>
        <Card label="Session requests" value={count((r) => r.pendingBookings)} tone="text-amber-600 dark:text-amber-300" />
        <Card label="Unpaid invoices" value={count((r) => r.unpaidInvoices)} />
      </div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Link href="/students/help-desk" className="border-dash-border bg-dash-card hover:bg-dash-muted rounded-xl border px-3.5 py-2 text-sm font-semibold">
          Help desk inbox
        </Link>
        <Link href="/students/deadlines" className="border-dash-border bg-dash-card hover:bg-dash-muted rounded-xl border px-3.5 py-2 text-sm font-semibold">
          Shared deadlines
        </Link>
      </div>
      <StudentsTable rows={rows} />
    </DashboardShell>
  );
}

function Card({ label, value, tone = "text-dash-foreground" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 shadow-sm">
      <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${value ? tone : "text-dash-foreground"}`}>{value}</p>
    </div>
  );
}
