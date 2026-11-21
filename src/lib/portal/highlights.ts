import type { SupabaseClient } from "@supabase/supabase-js";

export type PortalHighlights = {
  titles: number;
  students: number;
  projects: number;
  openJobs: number;
};

function countOrZero(error: { message: string } | null, count: number | null): number {
  if (error && /does not exist|schema cache/i.test(error.message)) return 0;
  if (error) return 0;
  return Number(count ?? 0);
}

/** Live portal totals for the free-plan home highlights strip. */
export async function fetchPortalHighlights(db: SupabaseClient): Promise<PortalHighlights> {
  const [proposals, earlier, students, projects, jobs] = await Promise.all([
    db.from("title_proposals").select("id", { count: "exact", head: true }).neq("status", "dropped"),
    db.from("last_year_projects").select("id", { count: "exact", head: true }),
    db.from("student_profiles").select("user_id", { count: "exact", head: true }),
    db.from("portal_workspaces").select("id", { count: "exact", head: true }),
    db.from("portal_jobs").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const proposalCount = countOrZero(proposals.error, proposals.count);
  const earlierCount = countOrZero(earlier.error, earlier.count);

  return {
    titles: proposalCount + earlierCount,
    students: countOrZero(students.error, students.count),
    projects: countOrZero(projects.error, projects.count),
    openJobs: countOrZero(jobs.error, jobs.count),
  };
}

export function formatHighlightCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  return Math.floor(n).toLocaleString("en-US");
}
