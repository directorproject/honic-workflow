import Link from "next/link";

import type { PlansMilestoneRow } from "@/lib/next-week-milestones-data";
import type { MilestoneWorkStatusValue } from "@/lib/milestone-work-status";
import { milestoneWorkStatusLabel } from "@/lib/milestone-work-status";
import { projectStatusUploadFolderLabel } from "@/lib/project-types";

function formatTargetCell(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Mon–Sat only (Sunday column removed); Sunday deadlines map onto Saturday in `effectiveDotColumnIso`. */
function weekDayLabelsMonSat(
  weekMonday: Date,
  todayIso: string
): { iso: string; short: string; num: string; isToday: boolean }[] {
  const out: { iso: string; short: string; num: string; isToday: boolean }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    const iso = `${y}-${mo}-${da}`;
    out.push({
      iso,
      short: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      num: String(d.getDate()),
      isToday: iso === todayIso,
    });
  }
  return out;
}

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Column used for the dot (Sunday targets share Saturday’s column). */
function effectiveDotColumnIso(targetIso: string): string {
  const d = new Date(`${targetIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return targetIso;
  if (d.getDay() === 0) {
    const sat = new Date(d);
    sat.setDate(d.getDate() - 1);
    return toIsoDateLocal(sat);
  }
  return targetIso;
}

function calendarDueHint(m: PlansMilestoneRow, todayIso: string): string {
  if (m.work_status === "done") return "Calendar: completed";
  if (m.target_date < todayIso) return "Calendar: overdue";
  if (m.target_date === todayIso) return "Calendar: due today";
  return "Calendar: upcoming";
}

function dotClasses(m: PlansMilestoneRow, todayIso: string): string {
  if (m.work_status === "done") return "bg-emerald-600/85 ring-2 ring-emerald-500/45";
  if (m.work_status === "blocked") return "bg-slate-500 ring-2 ring-slate-400/35";
  if (m.work_status === "in_progress") return "bg-violet-500 ring-2 ring-violet-400/40 dark:bg-violet-400";
  if (m.target_date < todayIso) return "bg-amber-500 ring-2 ring-amber-500/40";
  if (m.target_date === todayIso) return "bg-dash-accent ring-2 ring-dash-accent/35";
  return "bg-sky-500/90 ring-2 ring-sky-400/30 dark:bg-sky-400";
}

function workflowReadOnlyBadge(m: PlansMilestoneRow, todayIso: string) {
  const status = m.work_status;
  const label = milestoneWorkStatusLabel(status);
  const map: Record<MilestoneWorkStatusValue, string> = {
    pending: "border-dash-border bg-dash-muted/40 text-dash-muted-foreground",
    in_progress: "border-violet-500/45 bg-violet-500/15 text-violet-950 dark:text-violet-100",
    blocked: "border-slate-500/45 bg-slate-500/15 text-slate-900 dark:text-slate-100",
    done: "border-emerald-500/45 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
  };
  const overdueCal = m.target_date < todayIso && m.work_status !== "done";
  const overdueExtra = overdueCal ? " border-amber-500/70 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.45)]" : "";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${map[status]}${overdueExtra}`}
    >
      {label}
    </span>
  );
}

export function PlansMilestonesView({
  rows,
  weekHeading,
  weekMonday,
  todayIso,
}: {
  rows: PlansMilestoneRow[];
  weekHeading: string;
  weekMonday: Date;
  todayIso: string;
}) {
  const days = weekDayLabelsMonSat(weekMonday, todayIso);
  const sorted = [...rows].sort((a, b) => {
    const d = a.target_date.localeCompare(b.target_date);
    return d !== 0 ? d : a.sort_order - b.sort_order;
  });

  const nothingScheduled = sorted.length === 0;

  return (
    <div className="space-y-6">
      <header className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 shadow-sm sm:px-5">
        <h2 className="text-dash-foreground text-base font-semibold tracking-tight">Week of {weekHeading}</h2>
        <p className="text-dash-muted-foreground mt-1 max-w-3xl text-xs leading-relaxed">
          Read-only: workflow on <span className="text-dash-foreground font-medium">Manage → Timeline</span>. Includes done
          milestones. Grid is <span className="text-dash-foreground font-medium">Mon–Sat</span>; a dot on Saturday can mean a true Saturday deadline or a{" "}
          <span className="text-dash-foreground font-medium">Sunday</span> deadline mapped into that column.
        </p>
      </header>

      {nothingScheduled ? (
        <div className="border-dash-border bg-dash-muted/20 text-dash-muted-foreground rounded-2xl border border-dashed px-6 py-14 text-center text-sm">
          No milestones in this view. Add targets under{" "}
          <span className="text-dash-foreground font-medium">Manage → Timeline</span> or choose another week.
        </div>
      ) : (
        <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border shadow-sm">
          <div className="overflow-x-auto">
            <table className="divide-dash-border text-dash-foreground min-w-[76rem] w-full divide-y text-left text-sm">
              <thead className="bg-dash-muted/80">
                <tr className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  <th scope="col" className="text-dash-foreground w-[9.5rem] px-3 py-3 align-bottom whitespace-nowrap">
                    When (deadline)
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.iso}
                      scope="col"
                      className={`w-10 px-1 py-3 text-center align-bottom font-semibold ${
                        d.isToday ? "text-dash-accent bg-dash-accent/10" : ""
                      }`}
                      title={d.iso}
                    >
                      <span className="block">{d.short}</span>
                      <span className="text-[10px] font-normal tabular-nums opacity-80">{d.num}</span>
                    </th>
                  ))}
                  <th scope="col" className="min-w-[7rem] px-3 py-3 align-bottom">
                    Client
                  </th>
                  <th scope="col" className="min-w-[8rem] px-3 py-3 align-bottom">
                    Project
                  </th>
                  <th scope="col" className="min-w-[11rem] px-3 py-3 align-bottom">
                    Milestone / task
                  </th>
                  <th scope="col" className="min-w-[7rem] px-3 py-3 align-bottom">
                    Assigned
                  </th>
                  <th scope="col" className="min-w-[10rem] px-3 py-3 align-bottom">
                    Workflow status
                  </th>
                  <th scope="col" className="min-w-[10rem] px-3 py-3 align-bottom">
                    Pipeline % · stage
                  </th>
                  <th scope="col" className="w-[5rem] px-3 py-3 align-bottom text-center">
                    Edit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-dash-border divide-y">
                {sorted.map((m) => {
                  const projLabel = projectStatusUploadFolderLabel(m.projectStatus);
                  const targetFmt = formatTargetCell(m.target_date);
                  const columnIso = effectiveDotColumnIso(m.target_date);
                  const sundayMapped = columnIso !== m.target_date;
                  return (
                    <tr key={m.milestoneId} className="hover:bg-dash-muted/35 transition-colors">
                      <td className="text-dash-foreground px-3 py-3 align-middle text-xs tabular-nums whitespace-nowrap">
                        <span className="font-semibold">{targetFmt}</span>
                        <span className="text-dash-muted-foreground block text-[10px] font-normal normal-case">
                          <span className="opacity-90">{m.target_date}</span>
                          <span className="opacity-70"> · deadline</span>
                          {sundayMapped ? (
                            <span className="text-amber-700 dark:text-amber-300"> · Sun → Sat column</span>
                          ) : null}
                        </span>
                      </td>
                      {days.map((d) => {
                        const hit = d.iso === columnIso;
                        return (
                          <td
                            key={`${m.milestoneId}-${d.iso}`}
                            className={`border-dash-border px-0 py-2 text-center align-middle ${
                              d.isToday ? "border-x border-dash-accent/25 bg-dash-accent/5" : ""
                            }`}
                          >
                            {hit ? (
                              <span
                                className={`mx-auto block h-3 w-3 rounded-full shadow-sm ${dotClasses(m, todayIso)}`}
                                title={
                                  sundayMapped
                                    ? `Deadline Sunday ${m.target_date} (shown on Sat column)`
                                    : `Target ${m.target_date}`
                                }
                              />
                            ) : (
                              <span className="text-dash-muted-foreground/35 block text-[10px]">·</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-dash-muted-foreground px-3 py-3 align-middle text-xs">{m.clientName ?? "—"}</td>
                      <td className="px-3 py-3 align-middle">
                        <Link
                          href={`/projects/${m.projectId}`}
                          className="text-dash-accent hover:text-dash-accent-dim font-semibold underline-offset-2 hover:underline"
                        >
                          {m.projectTitle}
                        </Link>
                      </td>
                      <td className="text-dash-foreground px-3 py-3 align-middle font-medium">{m.title}</td>
                      <td className="text-dash-muted-foreground px-3 py-3 align-middle text-xs">
                        {m.assignee?.trim() ? m.assignee.trim() : "—"}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        {workflowReadOnlyBadge(m, todayIso)}
                        <p className="text-dash-muted-foreground mt-1 text-[10px] leading-snug">{calendarDueHint(m, todayIso)}</p>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <p className="text-dash-foreground font-bold tabular-nums">{m.pipelineWeightedPercent}%</p>
                        <p className="text-dash-muted-foreground text-[10px] font-medium">Weighted pipeline</p>
                        <span className="border-dash-border text-dash-muted-foreground mt-1 inline-flex rounded-full border bg-dash-muted/30 px-2 py-0.5 text-[11px] font-medium capitalize">
                          {projLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle text-center">
                        <Link
                          href={`/projects/${m.projectId}/work`}
                          className="text-dash-accent text-[11px] font-semibold underline-offset-2 hover:underline"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-dash-muted-foreground border-dash-border border-t px-4 py-3 text-xs leading-relaxed">
            Done milestones stay listed. Update workflow from{" "}
            <span className="text-dash-foreground font-medium">Manage → Timeline</span>. Pipeline % uses the project checklist
            weights (same idea as the home activity table).
          </p>
        </div>
      )}
    </div>
  );
}
