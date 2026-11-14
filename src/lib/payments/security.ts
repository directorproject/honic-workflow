/**
 * Premium payment safety helpers.
 * Simulated / free entitlements must never run on production deployments.
 */

export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.HONIC_FORCE_LIVE_PAYMENTS === "true"
  );
}

/**
 * Dev-only simulated mobile-money success.
 * Never allowed when NODE_ENV/VERCEL_ENV is production, even if ALLOW_SIMULATED_* is set.
 */
export function simulatedPaymentsAllowed(): boolean {
  if (isProductionRuntime()) return false;
  return (
    process.env.ALLOW_SIMULATED_TITLE_PAYMENTS === "true" ||
    process.env.ALLOW_SIMULATED_PAYMENTS === "true" ||
    process.env.NODE_ENV === "development"
  );
}
