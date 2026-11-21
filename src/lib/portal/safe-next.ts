/** Post-login redirect targets — must stay on this portal host (never staff/Inova paths). */
export function safePortalNextPath(path: string | null | undefined): string | null {
  const p = String(path ?? "").trim();
  if (!p || p.startsWith("//") || /^https?:\/\//i.test(p)) return null;
  if (!p.startsWith("/portal")) return null;
  if (p === "/portal") return null;
  // Block any attempt to bounce into staff surfaces via encoded next=.
  const lower = p.toLowerCase();
  if (
    lower.startsWith("/login") ||
    lower.startsWith("/users") ||
    lower.startsWith("/finance") ||
    lower.startsWith("/analytics") ||
    lower.startsWith("/students") ||
    lower.startsWith("/projects") ||
    lower.startsWith("/drive") ||
    lower.startsWith("/plans") ||
    lower.startsWith("/clients") ||
    lower.startsWith("/poster") ||
    lower.startsWith("/client-side") ||
    (lower.startsWith("/titles") && !lower.startsWith("/portal/titles"))
  ) {
    return null;
  }
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