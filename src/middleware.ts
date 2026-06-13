import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isPublicAppPath } from "@/lib/auth-public-paths";
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

function requestHostname(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return host.split(":")[0]?.toLowerCase() ?? "";
}

function isAllowedOnShareHost(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/share" || pathname.startsWith("/share/")) return true;
  if (pathname.startsWith("/api/share/")) return true;
  if (pathname === "/share-push-sw.js") return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/logo.jpg") return true;
  return false;
}

/**
 * Share-only host: only public share routes.
 * Main app host: Supabase session required except public paths (share, login, assets).
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const shareHost = shareOnlyHostname();

  if (shareHost && requestHostname(request) === shareHost) {
    if (isAllowedOnShareHost(pathname)) {
      return NextResponse.next();
    }
    return new NextResponse("Not found.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const { supabaseResponse, user } = await updateSession(request);

  if (isPublicAppPath(pathname)) {
    if (user && pathname === "/login") {
      const home = new URL("/", request.url);
      return NextResponse.redirect(home);
    }
    return supabaseResponse;
  }

  if (!user) {
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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.jpg).*)",
  ],
};
