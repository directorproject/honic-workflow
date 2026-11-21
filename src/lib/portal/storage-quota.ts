import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FREE_PLAN_FILE_STORAGE_BYTES,
  MONTHLY_PLAN_FILE_STORAGE_BYTES,
  PAID_PLAN_FILE_STORAGE_BYTES,
  SEMESTER_PLAN_FILE_STORAGE_BYTES,
  YEAR_PLAN_FILE_STORAGE_BYTES,
  fileStorageBytesForDeskPlan,
  formatStorageQuota,
} from "@/lib/portal/config";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";

export {
  FREE_PLAN_FILE_STORAGE_BYTES,
  MONTHLY_PLAN_FILE_STORAGE_BYTES,
  SEMESTER_PLAN_FILE_STORAGE_BYTES,
  YEAR_PLAN_FILE_STORAGE_BYTES,
  PAID_PLAN_FILE_STORAGE_BYTES,
  fileStorageBytesForDeskPlan,
  formatStorageQuota,
};

/** Storage for a single student desk (active plan → tier quota; else free). */
export function fileStorageLimitForDesk(
  deskExpiresAt: string | null | undefined,
  deskPlan?: string | null,
): number {
  if (!hasActiveDeskPlan(deskExpiresAt)) return FREE_PLAN_FILE_STORAGE_BYTES;
  return fileStorageBytesForDeskPlan(deskPlan ?? "monthly");
}

/**
 * Workspace quota: highest active member plan wins (year 50 GB > semester 10 GB > monthly 2 GB).
 */
export async function workspaceFileStorageLimitBytes(
  db: SupabaseClient,
  workspaceId: string,
): Promise<number> {
  const { data: members } = await db
    .from("portal_workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  const ids = (members ?? []).map((m) => String(m.user_id)).filter(Boolean);
  if (!ids.length) return FREE_PLAN_FILE_STORAGE_BYTES;

  const { data: profiles } = await db
    .from("student_profiles")
    .select("desk_expires_at, desk_plan")
    .in("user_id", ids);

  let best = FREE_PLAN_FILE_STORAGE_BYTES;
  for (const p of profiles ?? []) {
    const expires = p.desk_expires_at ? String(p.desk_expires_at) : null;
    if (!hasActiveDeskPlan(expires)) continue;
    const limit = fileStorageBytesForDeskPlan(p.desk_plan ? String(p.desk_plan) : "monthly");
    if (limit > best) best = limit;
  }
  return best;
}
