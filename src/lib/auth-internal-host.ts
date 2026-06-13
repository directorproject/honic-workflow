import type { NextRequest } from "next/server";

import { isPublicAppPath } from "@/lib/auth-public-paths";

/** Dashboard hostname from NEXT_PUBLIC_APP_URL (e.g. inova.honiccompany.com). */
export function internalAppHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function requestHostname(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return host.split(":")[0]?.toLowerCase() ?? "";
}

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

/** True only on the internal dashboard host (inova) or localhost dev — not share / client-api hosts. */
export function requiresInternalAuth(request: NextRequest): boolean {
  const hostname = requestHostname(request);
  const internal = internalAppHostname();
  if (internal && hostname === internal) return true;
  if (isLocalDevHost(hostname)) return true;
  return false;
}

/** Public routes on non-internal hosts (share subdomains, etc.). */
export function isPublicOnExternalHost(pathname: string): boolean {
  return isPublicAppPath(pathname);
}
