import { unstable_cache, updateTag } from "next/cache";

import type { StudentProfile } from "@/lib/portal/data";
import { cohortKey, loadLiterature } from "@/lib/portal/title-choices";
import { confirmedProposalIds } from "@/lib/portal/title-claims";
import { listOpenJobs } from "@/lib/portal/jobs";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const LITERATURE_CATALOGUE_TAG = "literature-catalogue";
export const PORTAL_JOBS_TAG = "portal-jobs";
export const PORTAL_COURSES_TAG = "portal-courses";

export function studentLiteratureTag(userId: string) {
  return `literature-student-${userId}`;
}

/** Call from server actions after select/hide so lists refresh without waiting for TTL. */
export function revalidatePortalCatalogue(userId?: string) {
  updateTag(LITERATURE_CATALOGUE_TAG);
  if (userId) updateTag(studentLiteratureTag(userId));
}

/** Confirmed ownership — shared across catalogue builders. */
export async function cachedConfirmedProposalIds(): Promise<Set<string>> {
  const ids = await unstable_cache(
    async () => {
      const db = getSupabaseAdminClient();
      if (!db) return [] as string[];
      return [...(await confirmedProposalIds(db))];
    },
    ["confirmed-proposal-ids-v2"],
    { revalidate: 120, tags: [LITERATURE_CATALOGUE_TAG] },
  )();
  return new Set(ids);
}

type EarlierRow = { id: string | number; programme: string | null; source: string | null; title: string | null };

export async function cachedLastYearProjects(): Promise<EarlierRow[]> {
  return unstable_cache(
    async () => {
      const db = getSupabaseAdminClient();
      if (!db) return [];
      const { data, error } = await db.from("last_year_projects").select("id, programme, source, title");
      if (error) throw new Error(error.message);
      return (data ?? []) as EarlierRow[];
    },
    ["last-year-projects-v2"],
    { revalidate: 300, tags: [LITERATURE_CATALOGUE_TAG] },
  )();
}

/** Cached open catalogue for guests/staff list views (no shortlist logic). */
export async function loadGuestLiteratureCatalogue() {
  return unstable_cache(
    async () => {
      const db = getSupabaseAdminClient();
      if (!db) return { mine: [], items: [] as Awaited<ReturnType<typeof loadLiterature>>["items"] };
      return loadLiterature(db, null, null, { includeBriefs: false });
    },
    ["portal-literature-guest-v2"],
    { revalidate: 300, tags: [LITERATURE_CATALOGUE_TAG] },
  )();
}

/** Per-student shortlist view — refreshes after select/hide via tag invalidation. */
export async function loadStudentLiteratureCatalogue(userId: string, profile: StudentProfile) {
  const cohort = cohortKey(profile);
  return unstable_cache(
    async () => {
      const db = getSupabaseAdminClient();
      if (!db) return { mine: [], items: [] as Awaited<ReturnType<typeof loadLiterature>>["items"] };
      return loadLiterature(db, userId, profile, { includeBriefs: false });
    },
    ["portal-literature-student", userId, cohort],
    { revalidate: 60, tags: [LITERATURE_CATALOGUE_TAG, studentLiteratureTag(userId)] },
  )();
}

/** Jobs browse for guests (viewer-specific flags are all false). */
export async function loadGuestOpenJobs() {
  return unstable_cache(
    async () => {
      const db = getSupabaseAdminClient();
      if (!db) return [];
      return listOpenJobs(db, null);
    },
    ["portal-jobs-open-v2"],
    { revalidate: 120, tags: [PORTAL_JOBS_TAG] },
  )();
}