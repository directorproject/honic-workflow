import type { SupabaseClient } from "@supabase/supabase-js";

import { filterByAcademicYear, type AcademicYearSelection } from "@/lib/academic-year";
import { getSelectedAcademicYear } from "@/lib/academic-year-server";
import type { DashboardBanner, RegisteredClientRow } from "@/lib/dashboard-types";
import { bannerForRegistry, fetchRegisteredClientsForYear } from "@/lib/registered-clients";
import { getSupabaseAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase-server";

export type { DashboardBanner, RegisteredClientRow } from "@/lib/dashboard-types";

function startOfUtcMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function fetchTrackingCounts(
  supabase: SupabaseClient,
  year: AcademicYearSelection,
): Promise<{
  totalProjects: number | null;
  activeProjects: number | null;
  openTasks: number | null;
}> {
  let totalProjects: number | null = null;
  let activeProjects: number | null = null;
  let openTasks: number | null = null;

  const total = await filterByAcademicYear(
    supabase.from("tracked_projects").select("*", { count: "exact", head: true }),
    year,
  );
  if (!total.error && typeof total.count === "number") {
    totalProjects = total.count;
  }

  const active = await filterByAcademicYear(
    supabase
      .from("tracked_projects")
      .select("*", { count: "exact", head: true })
      .in("status", ["planning", "active", "prototype_phase", "testing"]),
    year,
  );
  if (!active.error && typeof active.count === "number") {
    activeProjects = active.count;
  }

  const tasks = await filterByAcademicYear(
    supabase
      .from("project_tasks")
      .select("id, tracked_projects!inner(created_at)", { count: "exact", head: true })
      .neq("status", "done"),
    year,
    "tracked_projects.created_at",
  );
  if (!tasks.error && typeof tasks.count === "number") {
    openTasks = tasks.count;
  }

  return { totalProjects, activeProjects, openTasks };
}

export async function loadDashboardData(): Promise<{
  clients: RegisteredClientRow[];
  totalProjects: number | null;
  activeProjects: number | null;
  openTasks: number | null;
  registryNewThisMonth: number;
  banner: DashboardBanner | null;
}> {
  const supabase = getSupabaseAdminClient();
  const usingServiceRole = hasSupabaseServiceRoleEnv();

  if (!supabase) {
    return {
      clients: [],
      totalProjects: null,
      activeProjects: null,
      openTasks: null,
      registryNewThisMonth: 0,
      banner: {
        tone: "error",
        text:
          "No database connection. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to .env.local, then restart npm run dev.",
      },
    };
  }

  const year = await getSelectedAcademicYear();
  const clients = await fetchRegisteredClientsForYear(supabase, year);
  const banner = bannerForRegistry({
    clientsLength: clients.length,
    hints: [],
    usingServiceRole,
  });

  const counts = await fetchTrackingCounts(supabase, year);

  const monthStart = startOfUtcMonth();
  const registryNewThisMonth = clients.filter((c) => {
    if (!c.firstSeenAt) return false;
    const t = new Date(c.firstSeenAt).getTime();
    return !Number.isNaN(t) && t >= monthStart.getTime();
  }).length;

  return {
    clients,
    totalProjects: counts.totalProjects,
    activeProjects: counts.activeProjects,
    openTasks: counts.openTasks,
    registryNewThisMonth,
    banner,
  };
}
