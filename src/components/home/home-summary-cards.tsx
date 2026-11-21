import type { HomeWorkflowSummaries } from "@/lib/home-workflow-data";

function Card({
  label,
  value,
  hint,
  icon,
  color,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: string;
  color: "blue" | "green" | "amber" | "red" | "slate" | "cyan" | "violet" | "orange";
}) {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400",
    amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400",
    slate: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400",
    cyan: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400",
    violet: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400",
  };

  return (
    <div className={`border rounded-2xl p-4 backdrop-blur-sm transition-all hover:shadow-lg sm:p-5 md:p-6 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold tracking-widest uppercase opacity-75">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl">{value}</p>
          {hint && <p className="mt-1 text-xs opacity-75">{hint}</p>}
        </div>
        <span className="text-2xl sm:text-3xl">{icon}</span>
      </div>
    </div>
  );
}

export function HomeSummaryCards({ s }: { s: HomeWorkflowSummaries }) {
  return (
    <div className="grid auto-rows-max grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
      <Card
        icon="🏢"
        label="Total Clients"
        value={s.totalClients}
        hint="From project invoices"
        color="blue"
      />
      <Card
        icon="📁"
        label="Total Projects"
        value={s.totalProjects}
        hint="Selected year"
        color="blue"
      />
      <Card
        icon="✅"
        label="Completed"
        value={s.completedProjects}
        hint="Project status"
        color="green"
      />
      <Card
        icon="⏳"
        label="Incomplete"
        value={s.incompleteProjects}
        hint="Not completed"
        color="amber"
      />
      <Card
        icon="🔴"
        label="Critical"
        value={s.criticalProjects}
        hint="Priority flag"
        color="red"
      />
      <Card
        icon="⏸️"
        label="On Hold"
        value={s.onHoldProjects}
        hint="Paused"
        color="slate"
      />
      <Card
        icon="📅"
        label="This Week"
        value={s.thisWeekProjects}
        hint="Due or overdue"
        color="cyan"
      />
      <Card
        icon="👤"
        label="Client Side"
        value={s.clientSideProjects}
        hint="Awaiting client"
        color="violet"
      />
    </div>
  );
}
