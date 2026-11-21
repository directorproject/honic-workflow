import type { SupabaseClient } from "@supabase/supabase-js";

import { hasActiveDeskPlan } from "@/lib/portal/title-limits";

export { hasActiveDeskPlan };

/** Features that need an active Nexis Desk (semester / year) plan. Browse-only stays free. */
export const PAID_DESK_FEATURES = {
  jobsPost: "Job posting",
  jobsApply: "Job applying",
  jobsMessage: "Job messaging",
  jobsManage: "Managing jobs",
  helpDesk: "Help desk",
  paidStorage: "2–50 GB project file storage (by plan)",
  freeTitleHides: "Free title hides",
} as const;

export type PaidDeskFeature = keyof typeof PAID_DESK_FEATURES;

export async function loadDeskExpiresAt(
  db: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("student_profiles")
    .select("desk_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.desk_expires_at ? String(data.desk_expires_at) : null;
}

export async function userHasActiveDeskPlan(db: SupabaseClient, userId: string): Promise<boolean> {
  return hasActiveDeskPlan(await loadDeskExpiresAt(db, userId));
}

/**
 * Block student mutations that need Nexis Desk.
 * Returns a user-facing message when the plan is missing or expired.
 */
export async function requireActiveDeskPlan(
  db: SupabaseClient,
  userId: string,
  feature: PaidDeskFeature = "helpDesk",
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const paid = await userHasActiveDeskPlan(db, userId);
    if (paid) return { ok: true };
    const label = PAID_DESK_FEATURES[feature];
    return {
      ok: false,
      message: `${label} needs an active Nexis Desk plan. You can still browse. Open Plans & access to upgrade.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not verify your plan." };
  }
}
