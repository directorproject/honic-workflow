/** Fire-and-forget link click ping (beacon preferred). Never blocks navigation. */
export function trackLinkClick(input: {
  linkKey: string;
  label?: string;
  href?: string;
}): void {
  const linkKey = String(input.linkKey ?? "").trim();
  if (!linkKey || typeof window === "undefined") return;

  const payload = JSON.stringify({
    linkKey,
    label: input.label ?? "",
    href: input.href ?? "",
    sourcePath: `${window.location.pathname}${window.location.search}`,
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/portal/track-link", blob)) return;
    }
  } catch {
    /* fall through */
  }

  void fetch("/api/portal/track-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
