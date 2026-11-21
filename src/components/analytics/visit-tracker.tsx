"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_KEY = "honic_visit_sid";

function getSessionKey(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || id.length < 8) {
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 32)
          : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `anon${Date.now().toString(36)}`;
  }
}

function canonicalizeClientPath(pathname: string): string {
  let path = pathname || "/";
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep */
  }
  return path;
}

/** Title detail pages are recorded server-side — avoid double-counting. */
function isServerTrackedTitleDetail(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (!p.startsWith("/portal/titles/")) return false;
  if (p === "/portal/titles/mine" || p.startsWith("/portal/titles/mine/")) return false;
  return true;
}

function ping(path: string) {
  if (typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && navigator.webdriver) return;

  const payload = JSON.stringify({
    path,
    sessionKey: getSessionKey(),
  });

  // Prefer fetch — sendBeacon + JSON is flaky on some mobile browsers.
  void fetch("/api/portal/track-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/portal/track-visit", blob);
      }
    } catch {
      /* soft-fail */
    }
  });
}

/** Fires once per client-side navigation (pathname). Soft-fails if API/tables missing. */
export function VisitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const last = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    // Ignore staff analytics itself to avoid self-noise.
    if (pathname === "/analytics" || pathname.startsWith("/analytics/")) return;

    const path = canonicalizeClientPath(pathname);
    if (isServerTrackedTitleDetail(path)) return;

    // Path only for counting (query ignored) so filters don't inflate visits.
    if (last.current === path) return;
    last.current = path;
    void searchParams; // keep hook dependency for remounts when query changes on same path
    ping(path);
  }, [pathname, searchParams]);

  return null;
}
