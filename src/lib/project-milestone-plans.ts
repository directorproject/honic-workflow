import type { ProjectMilestoneRow } from "@/lib/projects-data";

export type MilestoneForPlan = Pick<
  ProjectMilestoneRow,
  "id" | "title" | "target_date" | "completed_at" | "assignee" | "sort_order"
>;

export type DailyPlanRow = {
  /** Local calendar day (noon) for stable display */
  anchor: Date;
  dayLabel: string;
  /** Milestones whose target_date is this calendar day */
  targets: MilestoneForPlan[];
  /** Undated pending milestones rotated across the window */
  backlogSlice: MilestoneForPlan[];
};

export type WeeklyPlanBucket = {
  weekStart: Date;
  weekHeading: string;
  milestones: MilestoneForPlan[];
};

function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso || !String(iso).trim()) return null;
  const d = new Date(`${String(iso).trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function calendarDayEqual(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Monday-start week containing `day` (local). */
export function mondayOfWeekContaining(day: Date): Date {
  const d = startOfLocalDay(day);
  const dow = d.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  return d;
}

function formatDayHeading(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatWeekHeading(weekMonday: Date): string {
  const sun = new Date(weekMonday);
  sun.setDate(sun.getDate() + 6);
  const a = weekMonday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const b = sun.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${a}–${b}`;
}

function noon(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Builds a rolling 7-day window (starting today, local) and weekly buckets from pending milestones.
 */
export function buildMilestonePlans(milestones: ProjectMilestoneRow[], windowDays = 7): {
  daily: DailyPlanRow[];
  weekly: WeeklyPlanBucket[];
  completed: MilestoneForPlan[];
  pendingUndated: MilestoneForPlan[];
  /** Pending with target date before today (local start of day). */
  overdue: MilestoneForPlan[];
} {
  const all = milestones.map((m) => ({
    id: m.id,
    title: m.title,
    target_date: m.target_date,
    completed_at: m.completed_at,
    assignee: m.assignee,
    sort_order: m.sort_order,
  }));

  const pending = all
    .filter((m) => !m.completed_at)
    .sort((a, b) => a.sort_order - b.sort_order);

  const completed = all.filter((m) => Boolean(m.completed_at)).sort((a, b) => a.sort_order - b.sort_order);

  const dated = pending.filter((m) => parseDateOnly(m.target_date));
  const undated = pending.filter((m) => !parseDateOnly(m.target_date));

  const today = startOfLocalDay(new Date());
  const overdue = dated.filter((m) => {
    const td = parseDateOnly(m.target_date);
    return td !== null && td.getTime() < today.getTime();
  });

  const daily: DailyPlanRow[] = [];

  for (let i = 0; i < windowDays; i++) {
    const day = addDays(today, i);
    const targets = dated.filter((m) => {
      const td = parseDateOnly(m.target_date);
      return td !== null && calendarDayEqual(day, td);
    });
    daily.push({
      anchor: noon(day),
      dayLabel: formatDayHeading(day),
      targets,
      backlogSlice: [],
    });
  }

  undated.forEach((m, idx) => {
    const slot = idx % windowDays;
    daily[slot]?.backlogSlice.push(m);
  });

  const weekMap = new Map<number, WeeklyPlanBucket>();
  for (const m of dated) {
    const td = parseDateOnly(m.target_date);
    if (!td) continue;
    const mon = mondayOfWeekContaining(td);
    const key = mon.getTime();
    let bucket = weekMap.get(key);
    if (!bucket) {
      bucket = { weekStart: noon(mon), weekHeading: formatWeekHeading(mon), milestones: [] };
      weekMap.set(key, bucket);
    }
    bucket.milestones.push(m);
  }

  const weekly = Array.from(weekMap.values()).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  weekly.forEach((bucket) => {
    bucket.milestones.sort((a, b) => {
      const da = parseDateOnly(a.target_date)?.getTime() ?? 0;
      const db = parseDateOnly(b.target_date)?.getTime() ?? 0;
      if (da !== db) return da - db;
      return a.sort_order - b.sort_order;
    });
  });

  return {
    daily,
    weekly,
    completed,
    pendingUndated: undated,
    overdue,
  };
}
