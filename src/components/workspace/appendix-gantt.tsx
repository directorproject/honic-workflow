import { startOfMonth, toDays } from "@/lib/workspace/dates";
import type { Phase, Task, Workspace } from "@/lib/workspace/types";

/** Academic appendix palette — solid fills like a printed Gantt table. */
const BAR_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#7c3aed",
  "#7c2d12",
  "#1e3a8a",
  "#dc2626",
  "#581c87",
  "#111827",
  "#38bdf8",
  "#ca8a04",
  "#0d9488",
  "#db2777",
  "#4b5563",
  "#65a30d",
];

const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

export type AppendixMonth = { key: string; label: string; start: string; end: string };

function monthEnd(isoMonthStart: string): string {
  const [y, m] = isoMonthStart.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const endDays = toDays(next) - 1;
  return new Date(endDays * 86_400_000).toISOString().slice(0, 10);
}

function addMonths(isoMonthStart: string, n: number): string {
  const [y, m] = isoMonthStart.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-01`;
}

export function buildAppendixMonths(ws: Workspace, tasks: Task[]): AppendixMonth[] {
  const dates = [
    ws.start_date,
    ws.end_date,
    ...tasks.flatMap((t) => [t.start_date, t.due_date]),
  ].filter((d): d is string => Boolean(d));

  if (!dates.length) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    return Array.from({ length: 8 }, (_, i) => {
      const s = addMonths(start, i);
      const month = Number(s.slice(5, 7));
      return { key: s.slice(0, 7), label: MONTH_SHORT[month - 1], start: s, end: monthEnd(s) };
    });
  }

  dates.sort();
  let cursor = startOfMonth(dates[0]);
  const last = startOfMonth(dates[dates.length - 1]);
  const out: AppendixMonth[] = [];
  // Cap at 18 months so a print page stays readable.
  for (let i = 0; i < 18 && toDays(cursor) <= toDays(last); i++) {
    const month = Number(cursor.slice(5, 7));
    out.push({
      key: cursor.slice(0, 7),
      label: MONTH_SHORT[month - 1],
      start: cursor,
      end: monthEnd(cursor),
    });
    cursor = addMonths(cursor, 1);
  }
  return out;
}

function taskRange(t: Task): { start: string; end: string } | null {
  const start = t.start_date || t.due_date;
  const end = t.due_date || t.start_date;
  if (!start || !end) return null;
  return toDays(start) <= toDays(end) ? { start, end } : { start: end, end: start };
}

function overlapsMonth(range: { start: string; end: string }, month: AppendixMonth): boolean {
  return toDays(range.start) <= toDays(month.end) && toDays(range.end) >= toDays(month.start);
}

function sortedTasks(phases: Phase[], tasks: Task[]): Task[] {
  const phaseOrder = new Map(phases.map((p, i) => [p.id, i]));
  return [...tasks].sort((a, b) => {
    const pa = a.phase_id ? (phaseOrder.get(a.phase_id) ?? 999) : 999;
    const pb = b.phase_id ? (phaseOrder.get(b.phase_id) ?? 999) : 999;
    if (pa !== pb) return pa - pb;
    return (a.start_date ?? "").localeCompare(b.start_date ?? "") || a.title.localeCompare(b.title);
  });
}

function yearLabel(months: AppendixMonth[]): string {
  if (!months.length) return "";
  const y0 = months[0].key.slice(0, 4);
  const y1 = months[months.length - 1].key.slice(0, 4);
  return y0 === y1 ? y0 : `${y0}/${y1}`;
}

export function AppendixGanttTable({
  workspace,
  phases,
  tasks,
  appendixLabel = "Appendix: B Gantt Chart",
  className = "",
}: {
  workspace: Workspace;
  phases: Phase[];
  tasks: Task[];
  appendixLabel?: string;
  className?: string;
}) {
  const months = buildAppendixMonths(workspace, tasks);
  const rows = sortedTasks(phases, tasks);
  const years = yearLabel(months);

  const cell = "border border-black px-2 py-1.5 text-[12px] leading-snug";
  const head = `${cell} text-center font-semibold`;

  return (
    <div className={`font-serif text-black ${className}`} style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      <p className="mb-2 text-base font-bold">{appendixLabel}</p>

      {rows.length === 0 ? (
        <p className="border border-black px-3 py-4 text-sm">No tasks yet. Add tasks on the Gantt chart, then export again.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${head} text-left font-bold`}>Months ({years})</th>
              {months.map((m) => (
                <th key={m.key} className={head}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const range = taskRange(t);
              const color = BAR_COLORS[i % BAR_COLORS.length];
              return (
                <tr key={t.id}>
                  <td className={`${cell} whitespace-nowrap`}>{t.title}</td>
                  {months.map((m) => {
                    const on = range ? overlapsMonth(range, m) : false;
                    return (
                      <td
                        key={m.key}
                        className="border border-black p-0"
                        style={on ? { backgroundColor: color } : undefined}
                        title={on ? `${t.title}: ${m.label}` : undefined}
                      >
                        <span className="block h-6 min-w-[2.25rem]">&nbsp;</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
