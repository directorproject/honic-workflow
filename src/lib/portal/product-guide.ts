/** Account-bound product tour — new students stay pending until they finish every step. */

export const PORTAL_PRODUCT_GUIDE_KEY = "portal_product_guide";
export const PORTAL_PRODUCT_GUIDE_PENDING = "pending";
export const PORTAL_PRODUCT_GUIDE_DONE = "done";
export const PORTAL_GUIDE_STORAGE_KEY = "honic_nexis_guide_done_v1";
export const PORTAL_GUIDE_FINISH_HREF = "/portal/packs#plans";

export function productGuidePending(
  user: { user_metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  if (!user) return false;
  return (user.user_metadata?.[PORTAL_PRODUCT_GUIDE_KEY] ?? null) === PORTAL_PRODUCT_GUIDE_PENDING;
}

export function productGuideDone(
  user: { user_metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  if (!user) return false;
  return (user.user_metadata?.[PORTAL_PRODUCT_GUIDE_KEY] ?? null) === PORTAL_PRODUCT_GUIDE_DONE;
}

/** True until the account is marked done — covers new signups and older accounts with no flag. */
export function needsProductGuide(
  user: { user_metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  if (!user) return false;
  return !productGuideDone(user);
}

export function withProductGuidePending(meta: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...meta, [PORTAL_PRODUCT_GUIDE_KEY]: PORTAL_PRODUCT_GUIDE_PENDING };
}
