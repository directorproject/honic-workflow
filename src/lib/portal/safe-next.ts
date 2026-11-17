/** Post-login redirect targets — must stay on this portal host. */
export function safePortalNextPath(path: string | null | undefined): string | null {
  const p = String(path ?? "").trim();
  if (!p || !p.startsWith("/portal") || p.startsWith("//")) return null;
  if (p === "/portal") return null;
  return p;
}

export function portalAppRequiresSignIn(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (p === "/portal") return false;
  if (p.startsWith("/portal/auth/")) return false;
  if (p.startsWith("/portal/reset")) return false;
  if (p.startsWith("/portal/join/")) return false;
  if (p.startsWith("/portal/s/")) return false;
  if (!p.startsWith("/portal/")) return false;
  return true;
}