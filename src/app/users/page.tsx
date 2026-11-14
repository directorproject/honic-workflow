import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { RegisteredUsersTable } from "@/components/users/registered-users-table";
import { UsersRequestLinks } from "@/components/users/users-request-links";
import { academicYearLabel } from "@/lib/academic-year";
import { getSelectedAcademicYear } from "@/lib/academic-year-server";
import { requireStaffPage } from "@/lib/portal/accounts";
import { countPendingClaims } from "@/lib/portal/title-claims";
import { fetchRegisteredUsers } from "@/lib/registered-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Registered users · Honic" };

export default async function RegisteredUsersPage() {
  const db = await requireStaffPage();
  const year = await getSelectedAcademicYear();
  const yearLabel = year === "all" ? "all years" : academicYearLabel(year);

  let rows: Awaited<ReturnType<typeof fetchRegisteredUsers>> = [];
  let error: string | null = null;
  try {
    rows = await fetchRegisteredUsers(db, year);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not load users.";
  }

  const totalUsers = rows.length;
  const students = rows.filter((row) => !row.staff).length;
  const waiting = rows.filter((row) => !row.staff && !row.profileComplete).length;
  const pendingCount = await countPendingClaims(db).catch(() => 0);

  return (
    <DashboardShell
      title="Registered users"
      subtitle={`Portal accounts in ${yearLabel}. Links use secure public ids. Auth UUIDs stay in the database only.`}
      statusDotClass={error ? "bg-amber-500" : "bg-emerald-500"}
    >
      <p className="text-dash-muted-foreground mb-5 text-sm">
        Students sign up on the portal with their own email. This list is everyone created in the selected year, including staff. View opens details, titles, workspace, and staff actions. Use Requested titles for ownership claims and Help desk for portal chat.
      </p>

      <UsersRequestLinks totalUsers={totalUsers} pendingRequests={pendingCount} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Total users" value={totalUsers} />
        <Card label="Students" value={students} />
        <Card label="Details missing" value={waiting} />
        <Link
          href="/users/requests"
          className="border-dash-border bg-dash-card hover:bg-dash-muted block rounded-2xl border px-4 py-3 shadow-sm transition-colors"
        >
          <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">Requested titles</p>
          <p className="text-dash-foreground mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
            {pendingCount}
            {pendingCount > 0 ? (
              <span className="bg-dash-accent rounded-full px-2 py-0.5 text-xs font-bold text-white">new</span>
            ) : null}
          </p>
        </Link>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-dash-border bg-dash-card mb-6 rounded-2xl border border-amber-500/35 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">Could not load registered users.</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="border-dash-border bg-dash-card rounded-2xl border px-5 py-10 text-center">
          <p className="text-dash-muted-foreground text-sm">No accounts were created in this working year.</p>
        </div>
      ) : (
        <RegisteredUsersTable rows={rows} />
      )}
    </DashboardShell>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 shadow-sm">
      <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-dash-foreground mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
