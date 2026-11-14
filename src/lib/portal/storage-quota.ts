import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FREE_PLAN_FILE_STORAGE_BYTES,
  PAID_PLAN_FILE_STORAGE_BYTES,
  formatStorageQuota,
} from "@/lib/portal/config";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";

export {
  FREE_PLAN_FILE_STORAGE_BYTES,
  PAID_PLAN_FILE_STORAGE_BYTES,
  formatStorageQuota,
};

/** Paid Nexis Desk → 2 GB; otherwise free plan 250 MB. */
export function fileStorageLimitForDesk(deskExpiresAt: string | null | undefined): number {
  return hasActiveDeskPlan(deskExpiresAt) ? PAID_PLAN_FILE_STORAGE_BYTES : FREE_PLAN_FILE_STORAGE_BYTES;
}

/**
 * Workspace quota: 2 GB if any student member has an active paid desk plan, else 250 MB.
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
    .select("desk_expires_at")
    .in("user_id", ids);

  for (const p of profiles ?? []) {
    if (hasActiveDeskPlan(p.desk_expires_at ? String(p.desk_expires_at) : null)) {
      return PAID_PLAN_FILE_STORAGE_BYTES;
    }
  }
  return FREE_PLAN_FILE_STORAGE_BYTES;
}
