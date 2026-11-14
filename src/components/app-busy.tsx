"use client";

/**
 * Global busy overlay was removed — it patched fetch and forced a site-wide
 * wait cursor that could stick and make pages feel unclickable.
 * Use per-button spinners (Spinner / isPending) instead.
 */
export function AppBusy() {
  return null;
}
