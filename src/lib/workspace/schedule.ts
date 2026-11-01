import { addDays, diffDays, todayIso } from "@/lib/workspace/dates";
import type { Task } from "@/lib/workspace/types";

export function taskDone(t: Pick<Task, "status" | "progress">): number {
  return t.status === "done" ? 1 : Math.min(1, Math.max(0, t.progress / 100));
}

function span(t: Task): number {
  if (!t.start_date || !t.due_date) return 1;
  return Math.max(1, diffDays(t.due_date, t.start_date) + 1);
}

export type ScheduleHealth = {
  /** Share of work done, weighted by task length (0 to 100). */
  actual: number;
  /** Share of work that should be done by today according to the plan. */
  planned: number;
  overdue: Task[];
  dueSoon: Task[];
  doneCount: number;
  total: number;
  /** "on_track", "slightly_behind" (under 15 points) or "behind". */
  state: "on_track" | "slightly_behind" | "behind" | "empty";
};

export function scheduleHealth(tasks: Task[], today = todayIso()): ScheduleHealth {
  const work = tasks.filter((t) => !t.is_milestone || t.start_date);
  let total = 0;
  let done = 0;
  let planned = 0;
  for (const t of work) {
    const w = span(t);
    total += w;
    done += w * taskDone(t);
    if (t.start_date && t.due_date) {
      const elapsed = diffDays(today, t.start_date) + 1;
      planned += w * Math.min(1, Math.max(0, elapsed / w));
    }
  }
  const actualPct = total ? Math.round((done / total) * 100) : 0;
  const plannedPct = total ? Math.round((planned / total) * 100) : 0;
  const overdue = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today);
  const soonLimit = addDays(today, 7);
  const dueSoon = tasks
    .filter((t) => t.status !== "done" && t.due_date && t.due_date >= today && t.due_date <= soonLimit)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const gap = plannedPct - actualPct;
  return {
    actual: actualPct,
    planned: plannedPct,
    overdue,
    dueSoon,
    doneCount: tasks.filter((t) => t.status === "done").length,
    total: tasks.length,
    state: !tasks.length ? "empty" : gap <= 5 && !overdue.length ? "on_track" : gap < 15 ? "slightly_behind" : "behind",
  };
}

export type DateChange = { id: string; title: string; start_date: string; due_date: string; shiftDays: number };

/**
 * Suggested dates: unfinished overdue tasks restart today with their remaining length,
 * and every task that depends on a moved task starts after it (keeping its own length).
 */
export function suggestReschedule(tasks: Task[], today = todayIso()): DateChange[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const next = new Map<string, { start: string; due: string }>();
  for (const t of tasks) {
    if (t.start_date && t.due_date) next.set(t.id, { start: t.start_date, due: t.due_date });
  }

  for (const t of tasks) {
    if (t.status === "done" || !t.start_date || !t.due_date || t.due_date >= today) continue;
    const remaining = Math.max(1, Math.ceil(span(t) * (1 - taskDone(t))));
    const start = t.start_date > today ? t.start_date : today;
    next.set(t.id, { start, due: addDays(start, t.is_milestone ? 0 : remaining - 1) });
  }

  const ordered = [...tasks].sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
  for (let pass = 0; pass < tasks.length; pass++) {
    let moved = false;
    for (const t of ordered) {
      const cur = next.get(t.id);
      if (!cur || t.status === "done") continue;
      const latestDep = t.depends_on
        .map((d) => next.get(d)?.due)
        .filter((d): d is string => Boolean(d))
        .sort()
        .pop();
      if (latestDep && cur.start <= latestDep) {
        const len = diffDays(cur.due, cur.start);
        const start = addDays(latestDep, 1);
        next.set(t.id, { start, due: addDays(start, len) });
        moved = true;
      }
    }
    if (!moved) break;
  }

  const changes: DateChange[] = [];
  for (const [id, d] of next) {
    const t = byId.get(id);
    if (!t || t.status === "done") continue;
    if (d.start !== t.start_date || d.due !== t.due_date) {
      changes.push({ id, title: t.title, start_date: d.start, due_date: d.due, shiftDays: diffDays(d.due, t.due_date ?? d.due) });
    }
  }
  return changes.sort((a, b) => a.start_date.localeCompare(b.start_date));
}
