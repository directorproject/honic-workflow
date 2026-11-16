import type { SupabaseClient } from "@supabase/supabase-js";

import { hasActiveDeskPlan } from "@/lib/portal/title-limits";

/**
 * Who may open catalogue / published title source files.
 * - Staff: always
 * - Active Nexis Desk plan: yes
 * - Paid project-documents unlock (DOC* payment): yes
 * - Confirmed claim owner for their own published docs: yes (caller passes owner)
 */
export async function hasProjectDocumentsAccess(
  db: SupabaseClient,
  opts: {
    userId: string;
    deskExpiresAt?: string | null;
    isStaff?: boolean;
    isDocumentOwner?: boolean;
  },
): Promise<boolean> {
  if (opts.isStaff || opts.isDocumentOwner) return true;
  if (hasActiveDeskPlan(opts.deskExpiresAt)) return true;

  const { data } = await db
    .from("title_change_payments")
    .select("id")
    .eq("user_id", opts.userId)
    .eq("status", "paid")
    .ilike("reference", "DOC%")
    .limit(1)
    .maybeSingle();

  return Boolean(data?.id);
}

/** Storage path from a catalogue-docs API URL, or null. */
export function catalogueStoragePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = String(url).match(/\/api\/portal\/catalogue-docs\/(.+)$/i);
  if (!m?.[1]) return null;
  try {
    const path = m[1]
      .split("/")
      .map((p) => decodeURIComponent(p))
      .join("/");
    if (!path.startsWith("catalogue/") || path.includes("..") || !/\.pdf$/i.test(path)) return null;
    return path;
  } catch {
    return null;
  }
}
