import type { User } from "@supabase/supabase-js";

/** Staff accounts carry app_metadata.role = "staff" (set server-side only; users cannot edit app_metadata). */
export function isStaffUser(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  return user?.app_metadata?.role === "staff";
}
