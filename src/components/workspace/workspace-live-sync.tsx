"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Soft live refresh for supervisor (and optional student Review).
 * Keeps shared docs / marks appearing without a manual reload.
 */
export function WorkspaceLiveSync({
  enabled,
  intervalMs = 4000,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const pull = () => {
      if (document.visibilityState === "hidden") return;
      router.refresh();
    };

    const start = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(pull, intervalMs);
    };

    start();
    pull();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        pull();
        start();
      }
    };
    const onFocus = () => pull();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
