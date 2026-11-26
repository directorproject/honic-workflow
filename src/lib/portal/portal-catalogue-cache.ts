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
    ["confirmed-proposal-ids-v3"],
    { revalidate: 120, tags: [LITERATURE_CATALOGUE_TAG] },
  )();
  return new Set(ids);
}

type EarlierRow = {
  id: string | number;
  programme: string | null;
  source: string | null;
  title: string | null;
  /** Omitted from list cache — fetch via title-brief API / detail page. */
  notes?: string | null;
};

export async function cachedLastYearProjects(): Promise<EarlierRow[]> {
  return unstable_cache(
    async () => {
      const db = getSupabaseAdminClient();
      if (!db) return [];
      // No notes here — full briefs exceed Next unstable_cache 2MB when nested in catalogues.
      const { data, error } = await db.from("last_year_projects").select("id, programme, source, title");
      if (error) throw new Error(error.message);
      return (data ?? []) as EarlierRow[];
    },
    ["last-year-projects-v5"],
    { revalidate: 300, tags: [LITERATURE_CATALOGUE_TAG] },
  )();
}

/** Cached open catalogue for guests (hides peer-hidden titles) or staff browse (full list). */
export async function loadGuestLiteratureCatalogue(options?: { forGuest?: boolean }) {
  const forGuest = options?.forGuest ?? true;
  return unstable_cache(
    async () => {
      const db = getSupabaseAdminClient();
      if (!db) return { mine: [], items: [] as Awaited<ReturnType<typeof loadLiterature>>["items"] };
      // Keep this under Next's 2MB unstable_cache limit — briefs load on Read expand.
      return loadLiterature(db, null, null, { includeBriefs: false, guestCatalogue: forGuest });
    },
    ["portal-literature-guest-v9", forGuest ? "guest" : "staff"],
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
      // Briefs are fetched per-title on expand (cache cannot hold full notes payloads).
      return loadLiterature(db, userId, profile, { includeBriefs: false });
    },
    ["portal-literature-student-v3", userId, cohort],
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
    ["portal-jobs-open-v3"],
    { revalidate: 120, tags: [PORTAL_JOBS_TAG] },
  )();
}