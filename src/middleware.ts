import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
 * When NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN is set, that hostname may only serve share routes
 * and assets those pages need — not /projects, /api/google, etc.
 */
export function middleware(request: NextRequest) {
  const shareHost = shareOnlyHostname();
  if (!shareHost) {
    return NextResponse.next();
  }

  if (requestHostname(request) !== shareHost) {
    return NextResponse.next();
  }

  if (isAllowedOnShareHost(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return new NextResponse("Not found.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: [
    /*
     * Skip middleware for immutable static assets (still allowed on share host if requested).
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.jpg).*)",
  ],
};
