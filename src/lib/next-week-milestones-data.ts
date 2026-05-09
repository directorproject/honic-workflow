import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { normalizeRegisteredClientJoin } from "@/lib/supabase-relations";

export type NextWeekMilestoneRow = {
  milestoneId: string;
  title: string;
  target_date: string;
  assignee: string | null;
  sort_order: number;
  projectId: string;
  projectTitle: string;
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
 * Next calendar week (Mon–Sun) after the week that contains `now`.
 * Example: if today is Wednesday of week W, returns bounds for week W+1.
 */
export function getNextCalendarWeekIsoRange(now = new Date()): {
  startIso: string;
  endIso: string;
  monday: Date;
  sunday: Date;
} {
  const today = startOfLocalDay(now);
  const thisMonday = mondayOfWeekContaining(today);
  const nextMonday = addDays(thisMonday, 7);
  const nextSunday = addDays(nextMonday, 6);
  return {
    startIso: toIsoDateLocal(nextMonday),
    endIso: toIsoDateLocal(nextSunday),
    monday: nextMonday,
    sunday: nextSunday,
  };
}

export function formatNextWeekHeading(monday: Date, sunday: Date): string {
  const a = monday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const b = sunday.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${a}–${b}`;
}

export async function loadNextWeekMilestones(registeredClientId?: string): Promise<{
  milestones: NextWeekMilestoneRow[];
  weekHeading: string;
  startIso: string;
  endIso: string;
  error: string | null;
}> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      milestones: [],
      weekHeading: "",
      startIso: "",
      endIso: "",
      error: "Database not configured.",
    };
  }

  const { startIso, endIso, monday, sunday } = getNextCalendarWeekIsoRange();
  const weekHeading = formatNextWeekHeading(monday, sunday);

  const { data, error } = await supabase
    .from("project_milestones")
    .select(
      `
      id,
      title,
      target_date,
      assignee,
      sort_order,
      tracked_project_id,
      tracked_projects (
        id,
        title,
        registered_client_id,
        registered_clients ( name )
      )
    `
    )
    .gte("target_date", startIso)
    .lte("target_date", endIso)
    .is("completed_at", null)
    .order("target_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return {
      milestones: [],
      weekHeading,
      startIso,
      endIso,
      error: error.message,
    };
  }

  const milestones: NextWeekMilestoneRow[] = [];

  for (const row of data ?? []) {
    const r = row as {
      id: string;
      title: string;
      target_date: string | null;
      assignee: string | null;
      sort_order: number;
      tracked_project_id: string;
      tracked_projects: unknown;
    };
    const projRaw = r.tracked_projects;
    const proj = (
      Array.isArray(projRaw) ? projRaw[0] : projRaw
    ) as {
      id: string;
      title: string;
      registered_client_id: string;
      registered_clients: unknown;
    } | null;
    if (!proj?.id || !r.target_date) continue;

    const clientJoin = normalizeRegisteredClientJoin(proj.registered_clients);
    if (registeredClientId && proj.registered_client_id !== registeredClientId) continue;

    milestones.push({
      milestoneId: r.id,
      title: r.title,
      target_date: r.target_date,
      assignee: r.assignee,
      sort_order: r.sort_order,
      projectId: proj.id,
      projectTitle: proj.title,
      registered_client_id: proj.registered_client_id,
      clientName: clientJoin?.name ?? null,
    });
  }

  return { milestones, weekHeading, startIso, endIso, error: null };
}
