import type { HomeWorkflowSummaries } from "@/lib/home-workflow-data";

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 backdrop-blur-sm transition-all hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 sm:p-5 md:p-6">
      <p className="text-xs font-bold tracking-widest uppercase opacity-75 text-slate-600 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white sm:text-4xl">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-75 text-slate-600 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function HomeSummaryCards({ s }: { s: HomeWorkflowSummaries }) {
  return (
    <div className="grid auto-rows-max grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
      <Card
        label="Total Clients"
        value={s.totalClients}
        hint="From project invoices"
      />
      <Card
        label="Total Projects"
        value={s.totalProjects}
        hint="Selected year"
      />
      <Card
        label="Completed"
        value={s.completedProjects}
        hint="Project status"
      />
      <Card
        label="Incomplete"
        value={s.incompleteProjects}
        hint="Not completed"
      />
      <Card
        label="Critical"
        value={s.criticalProjects}
        hint="Priority flag"
      />
      <Card
        label="On Hold"
        value={s.onHoldProjects}
        hint="Paused"
      />
      <Card
        label="This Week"
        value={s.thisWeekProjects}
        hint="Due or overdue"
      />
      <Card
        label="Client Side"
        value={s.clientSideProjects}
        hint="Awaiting client"
      />
    </div>
  );
}
