/** Proceed with Google is on unless explicitly disabled with PORTAL_GOOGLE_SIGNIN=false. */
export function isPortalGoogleSignInEnabled(): boolean {
  const v = process.env.PORTAL_GOOGLE_SIGNIN?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  return true;
}
