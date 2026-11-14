/** Routes that do not require a Supabase session (main app host). */
export function isPublicAppPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (p === "/login") return true;
  // Supervisor portal has its own sign-in (not staff /login).
  if (p === "/supervisor" || p.startsWith("/supervisor/")) return true;
  if (p === "/portal" || p.startsWith("/portal/") || p.startsWith("/api/portal/")) return true;
  if (p.startsWith("/auth/")) return true;
  if (p === "/share" || p.startsWith("/share/")) return true;
  if (p.startsWith("/api/share/")) return true;
  if (p === "/share-push-sw.js") return true;
  if (p.startsWith("/api/cron/")) return true;
  // Payment provider callbacks (Snippe HMAC-verified in the route).
  if (p.startsWith("/api/payments/")) return true;
  if (p.startsWith("/_next/")) return true;
  if (p === "/favicon.ico" || p === "/robots.txt" || p === "/logo.jpg" || p === "/pdf.worker.min.mjs" || p === "/pdf-worker.js") {
    return true;
  }
  if (p === "/portal.webmanifest" || p.startsWith("/portal-icon-")) return true;
  return false;
}
