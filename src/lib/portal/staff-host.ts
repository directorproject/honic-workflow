/** Staff / Inova host — students on the share portal must never be sent here. */

export function staffAppHostname(): string | null {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (!raw) return null;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when an absolute URL targets the staff dashboard host (or known Inova hostname). */
export function isStaffOrInovaAbsoluteUrl(href: string): boolean {
  const raw = String(href ?? "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (host.includes("inova")) return true;
    const staff = staffAppHostname();
    if (staff && host === staff) return true;
    return false;
  } catch {
    return false;
  }
}
