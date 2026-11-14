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

/** True for an address on this PC's own network, including Wi-Fi and Tailscale. */
function isPrivateNetworkHost(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) return true;
  return a === 100 && b >= 64 && b <= 127;
}

function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    isPrivateNetworkHost(hostname)
  );
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
