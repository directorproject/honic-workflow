/** Calendar dates are plain "YYYY-MM-DD" strings in East Africa Time; math is done in UTC days. */

const TZ = "Africa/Dar_es_Salaam";
const DAY_MS = 86_400_000;

export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function toDays(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

export function fromDays(days: number): string {
  return new Date(days * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return fromDays(toDays(iso) + n);
}

export function diffDays(a: string, b: string): number {
  return toDays(a) - toDays(b);
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ, ...opts });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** Monday of the week containing iso. */
export function startOfWeek(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** "in 3 days", "today", "2 days ago". */
export function relativeDays(iso: string, today = todayIso()): string {
  const d = diffDays(iso, today);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

/** Default project end: 30 June of the academic year that contains today (year runs 30 Sep to 30 Sep). */
export function defaultEndDate(today = todayIso()): string {
  const y = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const endYear = month >= 10 || (month === 9 && Number(today.slice(8, 10)) >= 30) ? y + 1 : y;
  const end = `${endYear}-06-30`;
  return toDays(end) - toDays(today) < 60 ? addDays(today, 120) : end;
}
