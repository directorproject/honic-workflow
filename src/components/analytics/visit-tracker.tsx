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

function ping(path: string) {
  if (typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && navigator.webdriver) return;

  const payload = JSON.stringify({
    path,
    sessionKey: getSessionKey(),
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/portal/track-visit", blob)) return;
    }
  } catch {
    /* fall through */
  }

  void fetch("/api/portal/track-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
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

    const search = searchParams?.toString() ?? "";
    // Path only for counting (query ignored) so filters don't inflate visits.
    const key = pathname;
    if (last.current === key) return;
    last.current = key;
    void search; // keep hook dependency for future if needed
    ping(pathname);
  }, [pathname, searchParams]);

  return null;
}
