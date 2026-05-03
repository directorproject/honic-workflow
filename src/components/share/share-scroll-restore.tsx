"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "shareListScroll:";

/** `/share/{slug}/{token}` only (not file preview). */
function isShareProjectPage(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length === 3 && parts[0] === "share";
}

/**
 * After returning from `/share/.../view/...`, restores vertical scroll on the project share page
 * (mobile Safari often ignores Next.js scroll restoration alone).
 */
export function ShareScrollRestore() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isShareProjectPage(pathname)) return;

    const key = `${STORAGE_PREFIX}${pathname}`;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch {
      return;
    }
    if (raw == null) return;

    const y = Number.parseInt(raw, 10);
    if (!Number.isFinite(y) || y < 0) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }

    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
