import type { User } from "@supabase/supabase-js";

import { getServerUser } from "@/lib/supabase/server";

/** Staff accounts carry app_metadata.role = "staff" (set server-side only; users cannot edit app_metadata). */
export function isStaffUser(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  return user?.app_metadata?.role === "staff";
}

/** Call at the top of every staff-only server action (middleware alone is not enough). */
export async function requireStaffActor(): Promise<User> {
  const user = await getServerUser();
  if (!user || !isStaffUser(user)) {
    throw new Error("Staff access required.");
  }
  return user;
}
