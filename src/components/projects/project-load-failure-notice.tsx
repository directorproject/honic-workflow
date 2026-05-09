import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { loadDashboardData } from "@/lib/dashboard-data";
import { isDashboardRegistryOk } from "@/lib/dashboard-types";

/**
 * Shown when `loadProjectDetail` fails for a reason other than “no row” (e.g. missing DB column, env misconfiguration).
 */
export async function ProjectLoadFailureNotice({ message }: { message: string }) {
  const dash = await loadDashboardData();
  const connected = isDashboardRegistryOk(dash.banner);
  const statusDotClass = connected
    ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
    : "bg-amber-500";

  return (
    <DashboardShell
      title="Could not open project"
      subtitle="Something went wrong loading this project from the database."
      statusDotClass={statusDotClass}
    >
      <div
        role="alert"
        className="border-dash-border bg-dash-card max-w-2xl rounded-2xl border p-6 shadow-sm"
      >
        <p className="text-dash-foreground text-sm font-medium">Error details</p>
        <p className="text-dash-muted-foreground mt-2 font-mono text-xs leading-relaxed break-words">{message}</p>
        <p className="text-dash-muted-foreground mt-4 text-sm leading-relaxed">
          Common causes: the URL id does not match any project, the project was deleted, Supabase env keys are missing,
          or a new app version expects columns that are not in your database yet. Run pending SQL files from the repo’s{" "}
          <code className="text-dash-foreground">supabase/</code> folder (for example{" "}
          <code className="text-dash-foreground">014_registered_clients_phone.sql</code> and{" "}
          <code className="text-dash-foreground">015_project_milestones_assignee.sql</code>,{" "}
          <code className="text-dash-foreground">018_project_milestones_work_status.sql</code>) in the Supabase SQL editor,
          then reload.
        </p>
        <Link
          href="/projects"
          className="text-dash-accent mt-6 inline-block text-sm font-semibold underline-offset-2 hover:underline"
        >
          ← Back to projects
        </Link>
      </div>
    </DashboardShell>
  );
}
