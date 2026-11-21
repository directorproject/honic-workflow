import type { SupabaseClient } from "@supabase/supabase-js";

export type PortalHighlights = {
  titles: number;
  openJobs: number;
  titlesProtected: number;
  studyGroups: number;
};

function countOrZero(error: { message: string } | null, count: number | null): number {
  if (error && /does not exist|schema cache/i.test(error.message)) return 0;
  if (error) return 0;
  return Number(count ?? 0);
}

/** Live portal totals for the free-plan home highlights strip. */
export async function fetchPortalHighlights(db: SupabaseClient): Promise<PortalHighlights> {
  const [proposals, earlier, jobs, hidden, groups] = await Promise.all([
    db.from("title_proposals").select("id", { count: "exact", head: true }).neq("status", "dropped"),
    db.from("last_year_projects").select("id", { count: "exact", head: true }),
    db.from("portal_jobs").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("title_selections").select("id", { count: "exact", head: true }).not("hidden_at", "is", null).is("released_at", null),
    db.from("zimamoto_groups").select("id", { count: "exact", head: true }),
  ]);

  return {
    titles: countOrZero(proposals.error, proposals.count) + countOrZero(earlier.error, earlier.count),
    openJobs: countOrZero(jobs.error, jobs.count),
    titlesProtected: countOrZero(hidden.error, hidden.count),
    studyGroups: countOrZero(groups.error, groups.count),
  };
}

export function formatHighlightCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  return Math.floor(n).toLocaleString("en-US");
}
