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
import { portalAppRequiresSignIn } from "@/lib/portal/safe-next";
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
  const p = pathname.toLowerCase();
  return p === "/portal" || p.startsWith("/portal/") || p.startsWith("/api/portal/");
}

/** Canonicalize /PORTAL → /portal so App Router + public-path checks always match. */
function canonicalizePortalCase(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (!isPortalPath(pathname)) return null;
  const lower = pathname.toLowerCase();
  if (pathname === lower) return null;
  const url = request.nextUrl.clone();
  url.pathname = lower;
  url.search = search;
  return NextResponse.redirect(url);
}

function isAllowedOnShareHost(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (p.startsWith("/_next/")) return true;
  if (p === "/about" || p === "/share-portal") return true;
  if (p === "/share" || p.startsWith("/share/")) return true;
  if (p.startsWith("/api/share/")) return true;
  if (p === "/supervisor" || p.startsWith("/supervisor/")) return true;
  if (isPortalPath(pathname)) return true;
  if (p === "/share-push-sw.js") return true;
  if (p === "/portal.webmanifest" || p.startsWith("/portal-icon-") || p.startsWith("/templates/")) return true;
  if (
    p === "/favicon.ico" ||
    p === "/robots.txt" ||
    p === "/sitemap.xml" ||
    p === "/logo.jpg" ||
    p.startsWith("/logo-nexis")
  )
    return true;
  if (p === "/pdf.worker.min.mjs" || p === "/pdf-worker.js") return true;
  return false;
}

/**
 * Auth is required only on the internal dashboard host (NEXT_PUBLIC_APP_URL / localhost).
 * Share hosts and client share subdomains stay public — no login on shared links.
 * The student title portal (/portal) lives on the share host; the dashboard host redirects there.
 */
export async function middleware(request: NextRequest) {
  const caseFix = canonicalizePortalCase(request);
  if (caseFix) return caseFix;

  const pathname = request.nextUrl.pathname;
  const shareHost = shareOnlyHostname();
  const hostname = requestHostname(request);

  if (shareHost && hostname === shareHost) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
    if (isPortalPath(pathname) || pathname.toLowerCase() === "/supervisor" || pathname.toLowerCase().startsWith("/supervisor/")) {
      const { supabaseResponse, user } = await updateSession(request);
      const lower = pathname.toLowerCase();
      if (!user && portalAppRequiresSignIn(lower)) {
        const signIn = request.nextUrl.clone();
        signIn.pathname = "/portal";
        signIn.searchParams.set("auth", "signin");
        const returnPath = `${lower}${request.nextUrl.search}`;
        signIn.searchParams.set("next", returnPath);
        return NextResponse.redirect(signIn);
      }
      return supabaseResponse;
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

  if (shareHost && isPortalPath(pathname) && hostname === internalAppHostname()) {
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap\\.xml|logo\\.jpg|logo-nexis|portal-icon-|pdf\\.worker\\.min\\.mjs|pdf-worker\\.js).*)",
  ],
};
