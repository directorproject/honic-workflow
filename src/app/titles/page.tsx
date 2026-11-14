import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AddCourseForm } from "@/components/titles/add-course-form";
import { LastYearProjectsTable } from "@/components/titles/last-year-projects-table";
import { TitleClaimQueue } from "@/components/titles/title-claim-queue";
import { TitleProposalsBoard } from "@/components/titles/title-proposals-board";
import { academicYearLabel, isInAcademicYear } from "@/lib/academic-year";
import { getSelectedAcademicYear } from "@/lib/academic-year-server";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { loadTitleBank } from "@/lib/title-bank";

export const dynamic = "force-dynamic";

export default async function ProjectTitlesPage() {
  const year = await getSelectedAcademicYear();
  const yearLabel = year === "all" ? "all years" : academicYearLabel(year);
  const [dash, bank] = await Promise.all([loadDashboardData(), loadTitleBank()]);
  const connected = isDashboardRegistryOk(dash.banner);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  const { error } = bank;
  const lastYear = year === "all" ? bank.lastYear : bank.lastYear.filter((row) => row.year === year);
  const proposals = bank.proposals.filter((p) => isInAcademicYear(p.createdAt, year));
  const available = proposals.filter((p) => p.status === "available").length;
  const taken = proposals.filter((p) => p.status === "reserved" || p.status === "assigned").length;

  return (
    <DashboardShell
      title="Project titles"
      subtitle={`Titles in ${yearLabel}. Filter by year, institution, or course. Hide student and supervisor names when you need a shorter list.`}
      statusDotClass={statusDotClass}
    >
      {error ? (
        <div
          role="alert"
          className="border-dash-border bg-dash-card mb-6 rounded-2xl border border-amber-500/35 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">Could not load the title bank.</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-xs">
            If the tables are missing, run{" "}
            <code className="text-dash-foreground">supabase/v2/001_dashboard_baseline.sql</code> in the Supabase SQL
            editor to create them.
          </p>
        </div>
      ) : null}

      <TitleClaimQueue />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Last year projects" value={lastYear.length} />
        <SummaryCard label="ETE Min Two" value={lastYear.filter((r) => r.programme === "ETE").length} />
        <SummaryCard label="COE Project Realization" value={lastYear.filter((r) => r.programme === "COE").length} />
        <SummaryCard label="New titles available" value={available} accent />
        <SummaryCard label="Reserved or assigned" value={taken} />
      </div>

      <section className="mb-10">
        <h2 className="text-dash-foreground text-base font-semibold tracking-tight">New titles for selection</h2>
        <p className="text-dash-muted-foreground mt-1 mb-4 text-sm">
          Students pick available titles on the portal. Add one title, paste a list, or import a file. Filter by year,
          institution, and course. Release gives a title back so the student can choose again for free.
        </p>
        <div className="mb-4">
          <AddCourseForm courses={bank.courses} />
        </div>
        <TitleProposalsBoard key={String(year)} proposals={bank.proposals} courses={bank.courses} selectedYear={year} />
      </section>

      <section>
        <h2 className="text-dash-foreground text-base font-semibold tracking-tight">Last year projects</h2>
        <p className="text-dash-muted-foreground mt-1 mb-4 text-sm">
          Previous project record. The year comes from the presentation date. Hide the student or supervisor column, or
          use <span className="font-semibold">New title</span> to copy a project into the selection list.
        </p>
        <LastYearProjectsTable key={String(year)} rows={bank.lastYear} selectedYear={year} />
      </section>
    </DashboardShell>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 shadow-sm">
      <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-dash-accent" : "text-dash-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
