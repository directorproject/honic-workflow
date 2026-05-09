import { getSupabaseAdminClient } from "@/lib/supabase-server";
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
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday-start week containing `day` (local). */
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

/**
 * Current calendar week (Mon–Sun) containing `now` (local).
 */
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

type MilestoneQueryRow = {
  id: string;
  title: string;
  target_date: string | null;
  assignee: string | null;
  sort_order: number;
  tracked_project_id: string;
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
  };
}

const milestoneSelect = `
      id,
      title,
      target_date,
      assignee,
      sort_order,
      tracked_project_id,
      tracked_projects (
        id,
        title,
        status,
        registered_client_id,
        registered_clients ( name )
      )
    `;

export async function loadThisWeekAndOverdueMilestones(registeredClientId?: string): Promise<{
  thisWeek: PlansMilestoneRow[];
  overdue: PlansMilestoneRow[];
  weekHeading: string;
  startIso: string;
  endIso: string;
  todayIso: string;
  weekMonday: Date;
  error: string | null;
}> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      thisWeek: [],
      overdue: [],
      weekHeading: "",
      startIso: "",
      endIso: "",
      todayIso: "",
      weekMonday: new Date(0),
      error: "Database not configured.",
    };
  }

  const today = startOfLocalDay(new Date());
  const todayIso = toIsoDateLocal(today);
  const { startIso, endIso, monday, sunday } = getThisCalendarWeekIsoRange();
  const weekHeading = formatWeekRangeHeading(monday, sunday);

  const [weekRes, overdueRes] = await Promise.all([
    supabase
      .from("project_milestones")
      .select(milestoneSelect)
      .gte("target_date", startIso)
      .lte("target_date", endIso)
      .is("completed_at", null)
      .order("target_date", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("project_milestones")
      .select(milestoneSelect)
      .lt("target_date", todayIso)
      .not("target_date", "is", null)
      .is("completed_at", null)
      .order("target_date", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  const errMsg = weekRes.error?.message ?? overdueRes.error?.message ?? null;
  if (errMsg) {
    return {
      thisWeek: [],
      overdue: [],
      weekHeading,
      startIso,
      endIso,
      todayIso,
      weekMonday: monday,
      error: errMsg,
    };
  }

  /** In-range Mon–Sun, but only targets from today forward (earlier days appear under overdue only). */
  const thisWeek: PlansMilestoneRow[] = [];
  for (const row of weekRes.data ?? []) {
    const m = mapRowToPlansMilestone(row as MilestoneQueryRow, registeredClientId);
    if (m && m.target_date >= todayIso) thisWeek.push(m);
  }

  const overdue: PlansMilestoneRow[] = [];
  for (const row of overdueRes.data ?? []) {
    const m = mapRowToPlansMilestone(row as MilestoneQueryRow, registeredClientId);
    if (m) overdue.push(m);
  }

  return { thisWeek, overdue, weekHeading, startIso, endIso, todayIso, weekMonday: monday, error: null };
}
