import type { SupabaseClient } from "@supabase/supabase-js";

import { hasActiveDeskPlan } from "@/lib/portal/title-limits";

/** Free desk trial length for every new registered account. */
export const DESK_TRIAL_DAYS = 14;

export function isDeskTrialPlan(deskPlan: string | null | undefined): boolean {
  return String(deskPlan ?? "").toLowerCase() === "trial";
}

/**
 * Grant a one-time 14-day desk trial with monthly-plan service limits.
 * Skips if trial already used, or an active paid desk is already running.
 */
export async function ensureDeskTrial(
  db: SupabaseClient,
  userId: string,
): Promise<{ granted: boolean; deskExpiresAt: string | null; deskPlan: string | null }> {
  const id = String(userId ?? "").trim();
  if (!id) return { granted: false, deskExpiresAt: null, deskPlan: null };

  const { data: profile, error } = await db
    .from("student_profiles")
    .select("desk_expires_at, desk_plan, desk_trial_started_at")
    .eq("user_id", id)
    .maybeSingle();
  if (error) {
    // Column missing until migration 044 is applied — do not block the portal.
    if (/desk_trial_started_at|column|schema cache|does not exist/i.test(error.message)) {
      return {
        granted: false,
        deskExpiresAt: profile?.desk_expires_at ? String(profile.desk_expires_at) : null,
        deskPlan: profile?.desk_plan ? String(profile.desk_plan) : null,
      };
    }
    throw new Error(error.message);
  }
  if (!profile) return { granted: false, deskExpiresAt: null, deskPlan: null };

  const deskExpiresAt = profile.desk_expires_at ? String(profile.desk_expires_at) : null;
  const deskPlan = profile.desk_plan ? String(profile.desk_plan) : null;
  if (profile.desk_trial_started_at) {
    return { granted: false, deskExpiresAt, deskPlan };
  }
  // Already on a paid desk (or leftover active expiry) — mark trial consumed without resetting dates.
  if (hasActiveDeskPlan(deskExpiresAt) && !isDeskTrialPlan(deskPlan)) {
    await db
      .from("student_profiles")
      .update({ desk_trial_started_at: new Date().toISOString() })
      .eq("user_id", id)
      .is("desk_trial_started_at", null);
    return { granted: false, deskExpiresAt, deskPlan };
  }

  const started = new Date();
  const ends = new Date(started.getTime() + DESK_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const { error: upErr } = await db
    .from("student_profiles")
    .update({
      desk_plan: "trial",
      desk_expires_at: ends.toISOString(),
      desk_trial_started_at: started.toISOString(),
      updated_at: started.toISOString(),
    })
    .eq("user_id", id)
    .is("desk_trial_started_at", null);
  if (upErr) {
    if (/desk_trial_started_at|column|schema cache|does not exist/i.test(upErr.message)) {
      return { granted: false, deskExpiresAt, deskPlan };
    }
    throw new Error(upErr.message);
  }
  return { granted: true, deskExpiresAt: ends.toISOString(), deskPlan: "trial" };
}
