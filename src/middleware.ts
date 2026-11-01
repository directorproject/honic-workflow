import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  internalAppHostname,
  isPublicOnExternalHost,
  requestHostname,
  requiresInternalAuth,
} from "@/lib/auth-internal-host";
import { isPublicAppPath } from "@/lib/auth-public-paths";
import { isStaffUser } from "@/lib/auth-staff";
import { updateSession } from "@/lib/supabase/middleware";

/** Hostname for strict “share-only” routing (from NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN). */
function shareOnlyHostname(): string | null {
  const raw = process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isPortalPath(pathname: string): boolean {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

function isAllowedOnShareHost(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/share" || pathname.startsWith("/share/")) return true;
  if (isPortalPath(pathname)) return true;
  if (pathname.startsWith("/api/share/")) return true;
  if (pathname === "/share-push-sw.js") return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/logo.jpg") return true;
  return false;
}

/**
 * Auth is required only on the internal dashboard host (NEXT_PUBLIC_APP_URL / localhost).
 * Share hosts and client share subdomains stay public — no login on shared links.
 * The share host also serves the student title portal (/portal); its root redirects there.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const shareHost = shareOnlyHostname();
  const hostname = requestHostname(request);

  if (shareHost && hostname === shareHost) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
    if (isAllowedOnShareHost(pathname)) {
      return NextResponse.next();
    }
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!requiresInternalAuth(request)) {
    if (isPublicOnExternalHost(pathname)) {
      return NextResponse.next();
    }
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // The student portal lives on the share host so student sessions never mix with staff sessions.
  if (shareHost && hostname === internalAppHostname() && isPortalPath(pathname)) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${shareHost}`);
    return NextResponse.redirect(target);
  }

  const { supabaseResponse, user } = await updateSession(request);
  const staff = isStaffUser(user);

  if (isPublicAppPath(pathname)) {
    if (staff && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return supabaseResponse;
  }

  if (!staff) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.jpg).*)"],
};
