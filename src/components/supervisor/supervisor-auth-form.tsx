"use client";

import { PortalAuth, PORTAL_AUTH_HERO_IMAGE } from "@/components/portal/portal-auth";

/** @deprecated Prefer PORTAL_AUTH_HERO_IMAGE — kept for any external imports. */
export const SUPERVISOR_HERO_IMAGE = PORTAL_AUTH_HERO_IMAGE;

/** Same unified auth form as /portal, locked to supervisor for share links. */
export function SupervisorAuthForm({
  initialMode = "signin",
  prefillEmail = "",
  projectHint = "",
}: {
  initialMode?: "signin" | "signup";
  prefillEmail?: string;
  /** Optional project name shown when a student shared this form. */
  projectHint?: string;
}) {
  return (
    <PortalAuth
      initialMode={initialMode}
      initialRole="supervisor"
      prefillEmail={prefillEmail}
      projectHint={projectHint}
      lockRole={Boolean(prefillEmail || projectHint)}
    />
  );
}
