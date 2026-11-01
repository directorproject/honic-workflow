import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AddCourseForm } from "@/components/titles/add-course-form";
import { LastYearProjectsTable } from "@/components/titles/last-year-projects-table";
import { TitleProposalsBoard } from "@/components/titles/title-proposals-board";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";
import { loadTitleBank } from "@/lib/title-bank";

export const dynamic = "force-dynamic";

export default async function ProjectTitlesPage() {
  const [dash, bank] = await Promise.all([loadDashboardData(), loadTitleBank()]);
  const connected = isDashboardRegistryOk(dash.banner);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  const { lastYear, proposals, error } = bank;
  const available = proposals.filter((p) => p.status === "available").length;
  const taken = proposals.filter((p) => p.status === "reserved" || p.status === "assigned").length;

  return (
    <DashboardShell
      title="Project titles"
      subtitle="Last year's student projects and new titles for selection."
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
          Students pick available titles for their course on share.honiccompany.com/portal. Use Create project on a
          student&apos;s title to start their project and link their portal account. Release gives the title back to the
          list and lets the student choose again for free.
        </p>
        <div className="mb-4">
          <AddCourseForm courses={bank.courses} />
        </div>
        <TitleProposalsBoard proposals={proposals} courses={bank.courses} />
      </section>

      <section>
        <h2 className="text-dash-foreground text-base font-semibold tracking-tight">Last year projects</h2>
        <p className="text-dash-muted-foreground mt-1 mb-4 text-sm">
          From <code className="text-dash-foreground">docs/BENG22ETE-MIN2.xlsx</code> and{" "}
          <code className="text-dash-foreground">docs/BENG22COE-Project-Realization-Complete-Titles.xlsx</code>. Use{" "}
          <span className="font-semibold">New title</span> to turn a project into a title for selection.
        </p>
        <LastYearProjectsTable rows={lastYear} />
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
