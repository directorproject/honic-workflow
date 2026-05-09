import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { normalizeMilestoneWorkStatus } from "@/lib/milestone-work-status";
import { normalizeRegisteredClientJoin } from "@/lib/supabase-relations";

export type PlansMilestoneRow = {
  milestoneId: string;
  title: string;
  target_date: string;
  assignee: string | null;
  sort_order: number;
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  registered_client_id: string;
  clientName: string | null;
  work_status: ReturnType<typeof normalizeMilestoneWorkStatus>;
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mondayOfWeekContaining(day: Date): Date {
  const d = startOfLocalDay(day);
  const dow = d.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getThisCalendarWeekIsoRange(now = new Date()): {
  startIso: string;
  endIso: string;
  monday: Date;
  sunday: Date;
} {
  const today = startOfLocalDay(now);
  const monday = mondayOfWeekContaining(today);
  const sunday = addDays(monday, 6);
  return {
    startIso: toIsoDateLocal(monday),
    endIso: toIsoDateLocal(sunday),
    monday,
    sunday,
  };
}

export function formatWeekRangeHeading(monday: Date, sunday: Date): string {
  const a = monday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const b = sunday.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${a}–${b}`;
}

/** Shift the calendar week that contains `now` by `weekOffset` (negative = past weeks). */
export function getCalendarWeekRangeByOffset(weekOffset: number, now = new Date()) {
  const baseMonday = getThisCalendarWeekIsoRange(now).monday;
  const monday = addDays(baseMonday, weekOffset * 7);
  const sunday = addDays(monday, 6);
  return {
    monday,
    sunday,
    startIso: toIsoDateLocal(monday),
    endIso: toIsoDateLocal(sunday),
    weekHeading: formatWeekRangeHeading(monday, sunday),
  };
}

export function clampWeekOffset(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(52, Math.max(-52, Math.trunc(raw)));
}

/** Week offset vs “this week” for the ISO calendar date whose week should be shown (any day in that week). */
export function weekOffsetForContainingIsoDate(selectedIsoDate: string, now = new Date()): number {
  const trimmed = String(selectedIsoDate ?? "").trim();
  if (!trimmed) return 0;
  const picked = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(picked.getTime())) return 0;
  const baseMondayMs = getThisCalendarWeekIsoRange(now).monday.getTime();
  const pickedMondayMs = mondayOfWeekContaining(picked).getTime();
  const msWeek = 7 * 24 * 60 * 60 * 1000;
  return clampWeekOffset(Math.round((pickedMondayMs - baseMondayMs) / msWeek));
}

type MilestoneQueryRow = {
  id: string;
  title: string;
  target_date: string | null;
  assignee: string | null;
  sort_order: number;
  tracked_project_id: string;
  work_status?: string | null;
  tracked_projects: unknown;
};

function mapRowToPlansMilestone(row: MilestoneQueryRow, registeredClientId?: string): PlansMilestoneRow | null {
  const projRaw = row.tracked_projects;
  const proj = (
    Array.isArray(projRaw) ? projRaw[0] : projRaw
  ) as {
    id: string;
    title: string;
    status: string;
    registered_client_id: string;
    registered_clients: unknown;
  } | null;
  if (!proj?.id || !row.target_date) return null;

  const clientJoin = normalizeRegisteredClientJoin(proj.registered_clients);
  if (registeredClientId && proj.registered_client_id !== registeredClientId) return null;

  return {
    milestoneId: row.id,
    title: row.title,
    target_date: row.target_date,
    assignee: row.assignee,
    sort_order: row.sort_order,
    projectId: proj.id,
    projectTitle: proj.title,
    projectStatus: proj.status ?? "planning",
    registered_client_id: proj.registered_client_id,
    clientName: clientJoin?.name ?? null,
    work_status: normalizeMilestoneWorkStatus(row.work_status),
  };
}

const milestoneSelect = `
      id,
      title,
      target_date,
      assignee,
      sort_order,
      work_status,
      tracked_project_id,
      tracked_projects (
        id,
        title,
        status,
        registered_client_id,
        registered_clients ( name )
      )
    `;

export async function loadPlansBoardData(options: {
  registeredClientId?: string;
  weekOffset: number;
}): Promise<{
  inWeek: PlansMilestoneRow[];
  overdue: PlansMilestoneRow[];
  weekHeading: string;
  startIso: string;
  endIso: string;
  todayIso: string;
  weekMonday: Date;
  weekOffset: number;
  error: string | null;
}> {
  const weekOffset = clampWeekOffset(options.weekOffset);

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      inWeek: [],
      overdue: [],
      weekHeading: "",
      startIso: "",
      endIso: "",
      todayIso: "",
      weekMonday: new Date(0),
      weekOffset,
      error: "Database not configured.",
    };
  }

  const today = startOfLocalDay(new Date());
  const todayIso = toIsoDateLocal(today);
  const { monday, startIso, endIso, weekHeading } = getCalendarWeekRangeByOffset(weekOffset);

  const weekPromise = supabase
    .from("project_milestones")
    .select(milestoneSelect)
    .gte("target_date", startIso)
    .lte("target_date", endIso)
    .is("completed_at", null)
    .order("target_date", { ascending: true })
    .order("sort_order", { ascending: true });

  const overduePromise =
    weekOffset === 0
      ? supabase
          .from("project_milestones")
          .select(milestoneSelect)
          .lt("target_date", todayIso)
          .not("target_date", "is", null)
          .is("completed_at", null)
          .order("target_date", { ascending: true })
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as unknown[], error: null as null });

  const [weekRes, overdueRes] = await Promise.all([weekPromise, overduePromise]);

  const errMsg = weekRes.error?.message ?? (overdueRes as { error?: { message?: string } }).error?.message ?? null;
  if (errMsg) {
    return {
      inWeek: [],
      overdue: [],
      weekHeading,
      startIso,
      endIso,
      todayIso,
      weekMonday: monday,
      weekOffset,
      error: errMsg,
    };
  }

  const inWeekAll: PlansMilestoneRow[] = [];
  for (const row of weekRes.data ?? []) {
    const m = mapRowToPlansMilestone(row as MilestoneQueryRow, options.registeredClientId);
    if (!m) continue;
    if (weekOffset === 0) {
      if (m.target_date >= todayIso) inWeekAll.push(m);
    } else {
      inWeekAll.push(m);
    }
  }

  const overdue: PlansMilestoneRow[] = [];
  if (weekOffset === 0) {
    for (const row of (overdueRes as { data?: unknown[] }).data ?? []) {
      const m = mapRowToPlansMilestone(row as MilestoneQueryRow, options.registeredClientId);
      if (m) overdue.push(m);
    }
  }

  return {
    inWeek: inWeekAll,
    overdue,
    weekHeading,
    startIso,
    endIso,
    todayIso,
    weekMonday: monday,
    weekOffset,
    error: null,
  };
}

