import Link from "next/link";

import type { PlansMilestoneRow } from "@/lib/next-week-milestones-data";
import { MilestoneWorkStatusSelect } from "@/components/plans/milestone-work-status-select";
import { projectStatusUploadFolderLabel } from "@/lib/project-types";

function formatTargetCell(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function weekDayLabels(
  weekMonday: Date,
  todayIso: string
): { iso: string; short: string; num: string; isToday: boolean }[] {
  const out: { iso: string; short: string; num: string; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
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

/** Calendar hint vs today (independent of workflow dropdown). */
function calendarDueHint(m: PlansMilestoneRow, todayIso: string): string {
  if (m.target_date < todayIso) return "Calendar: overdue";
  if (m.target_date === todayIso) return "Calendar: due today";
  return "Calendar: upcoming";
}

function dotClasses(m: PlansMilestoneRow, todayIso: string): string {
  if (m.work_status === "blocked") return "bg-slate-500 ring-2 ring-slate-400/35";
  if (m.work_status === "in_progress") return "bg-violet-500 ring-2 ring-violet-400/40 dark:bg-violet-400";
  if (m.target_date < todayIso) return "bg-amber-500 ring-2 ring-amber-500/40";
  if (m.target_date === todayIso) return "bg-dash-accent ring-2 ring-dash-accent/35";
  return "bg-sky-500/90 ring-2 ring-sky-400/30 dark:bg-sky-400";
}

export function PlansMilestonesView({
  inWeek,
  overdue,
  weekHeading,
  weekMonday,
  todayIso,
  weekOffset,
}: {
  inWeek: PlansMilestoneRow[];
  overdue: PlansMilestoneRow[];
  weekHeading: string;
  weekMonday: Date;
  todayIso: string;
  weekOffset: number;
}) {
  const days = weekDayLabels(weekMonday, todayIso);
  const rows = [...overdue, ...inWeek].sort((a, b) => a.target_date.localeCompare(b.target_date));

  const nothingScheduled = rows.length === 0;

  return (
    <div className="space-y-6">
      <header className="border-dash-border bg-dash-card rounded-2xl border p-5 shadow-sm sm:p-6">
        <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">Week of {weekHeading}</h2>
        <p className="text-dash-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Timeline board for the selected calendar week. Use{" "}
          <span className="text-dash-foreground font-medium">Previous / Next week</span> to browse past or upcoming
          targets (still open). The dot marks the milestone deadline in this week&apos;s columns; choose workflow status
          (pending, in progress, blocked, done) per row —{" "}
          <span className="text-dash-foreground font-medium">Done</span> marks complete and removes the row after refresh.
          {weekOffset === 0 ? (
            <>
              {" "}
              <span className="text-dash-foreground font-medium">Overdue</span> lists open milestones dated before today.
            </>
          ) : null}
        </p>
      </header>

      {nothingScheduled ? (
        <div className="border-dash-border bg-dash-muted/20 text-dash-muted-foreground rounded-2xl border border-dashed px-6 py-14 text-center text-sm">
          No open milestones match this week
          {weekOffset !== 0 ? " (try another week or clear filters)" : ""}. Add target dates under{" "}
          <span className="text-dash-foreground font-medium">Manage → Timeline</span>, or pick another week above.
        </div>
      ) : (
        <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border shadow-sm">
          <div className="overflow-x-auto">
            <table className="divide-dash-border text-dash-foreground min-w-[82rem] w-full divide-y text-left text-sm">
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
                  <th scope="col" className="min-w-[8rem] px-3 py-3 align-bottom">
                    Project status
                  </th>
                  <th scope="col" className="w-[5rem] px-3 py-3 align-bottom text-center">
                    Edit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-dash-border divide-y">
                {rows.map((m) => {
                  const projLabel = projectStatusUploadFolderLabel(m.projectStatus);
                  const targetFmt = formatTargetCell(m.target_date);
                  return (
                    <tr key={m.milestoneId} className="hover:bg-dash-muted/35 transition-colors">
                      <td className="text-dash-foreground px-3 py-3 align-middle text-xs tabular-nums whitespace-nowrap">
                        <span className="font-semibold">{targetFmt}</span>
                        <span className="text-dash-muted-foreground block text-[10px] font-normal normal-case">
                          → {targetFmt} <span className="opacity-70">(deadline)</span>
                        </span>
                      </td>
                      {days.map((d) => {
                        const hit = d.iso === m.target_date;
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
                                title={`Target ${m.target_date}`}
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
                        <MilestoneWorkStatusSelect milestoneId={m.milestoneId} value={m.work_status} />
                        <p className="text-dash-muted-foreground mt-1 text-[10px] leading-snug">{calendarDueHint(m, todayIso)}</p>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className="border-dash-border text-dash-muted-foreground inline-flex rounded-full border bg-dash-muted/30 px-2 py-0.5 text-[11px] font-medium capitalize">
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
            Dots mark the milestone <span className="text-dash-foreground font-medium">deadline</span> within the week
            columns shown. Workflow status is saved immediately; <span className="text-dash-foreground font-medium">Done</span>{" "}
            sets completion on the milestone.
          </p>
        </div>
      )}
    </div>
  );
}
