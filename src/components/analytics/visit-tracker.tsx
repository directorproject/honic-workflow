"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_KEY = "honic_visit_sid";
export const VISIT_SESSION_COOKIE = "honic_visit_sid";
const VISIT_LAST_PREFIX = "honic_visit_at:";
/** Match server VISIT_DEDUP_MS in page-visits.ts */
const VISIT_DEDUP_MS = 30 * 60 * 1000;

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
    try {
      document.cookie = `${VISIT_SESSION_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=86400; samesite=lax`;
    } catch {
      /* ignore */
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

/** Literature list + title detail are recorded server-side — avoid double-counting. */
function isServerTrackedTitlesPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (p === "/portal/titles") return true;
  if (!p.startsWith("/portal/titles/")) return false;
  if (p === "/portal/titles/mine" || p.startsWith("/portal/titles/mine/")) return false;
  return true;
}

function ping(path: string) {
  if (typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && navigator.webdriver) return;

  try {
    const storageKey = `${VISIT_LAST_PREFIX}${path}`;
    const last = Number(sessionStorage.getItem(storageKey) ?? 0);
    if (last && Date.now() - last < VISIT_DEDUP_MS) return;
    sessionStorage.setItem(storageKey, String(Date.now()));
  } catch {
    /* still ping server */
  }

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
    if (isServerTrackedTitlesPath(path)) return;

    // Path only for counting (query ignored) so filters don't inflate visits.
    if (last.current === path) return;
    last.current = path;
    void searchParams; // keep hook dependency for remounts when query changes on same path
    ping(path);
  }, [pathname, searchParams]);

  return null;
}
