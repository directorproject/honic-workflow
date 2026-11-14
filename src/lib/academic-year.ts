/**
 * Honic's working year runs from 30 September to 29 September (East Africa Time, UTC+3).
 * A year is identified by its start year: 2026 = 30 Sep 2026 – 29 Sep 2027 ("2026/2027").
 */
export const ACADEMIC_YEAR_COOKIE = "honic_academic_year";

/** Earliest year with data in the dashboard. */
export const FIRST_ACADEMIC_YEAR = 2025;

export type AcademicYearSelection = number | "all";

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function academicYearOf(date: Date = new Date()): number {
  const eat = new Date(date.getTime() + EAT_OFFSET_MS);
  const y = eat.getUTCFullYear();
  const beforeStart = eat.getUTCMonth() < 8 || (eat.getUTCMonth() === 8 && eat.getUTCDate() < 30);
  return beforeStart ? y - 1 : y;
}

export function academicYearLabel(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
}

/** Half-open range [start, end) as ISO timestamps for filtering timestamptz columns. */
export function academicYearRange(startYear: number): { startIso: string; endIso: string } {
  return {
    startIso: `${startYear}-09-30T00:00:00+03:00`,
    endIso: `${startYear + 1}-09-30T00:00:00+03:00`,
  };
}

export function selectableAcademicYears(now: Date = new Date()): number[] {
  const current = academicYearOf(now);
  const years: number[] = [];
  for (let y = current; y >= FIRST_ACADEMIC_YEAR; y--) years.push(y);
  return years;
}

export function parseAcademicYearSelection(raw: string | null | undefined): AcademicYearSelection {
  if (raw === "all") return "all";
  const n = Number(raw);
  if (Number.isInteger(n) && n >= FIRST_ACADEMIC_YEAR && n <= academicYearOf()) return n;
  return academicYearOf();
}

/** True when an ISO date or timestamp falls in the selected working year. A date-only value is read at noon East Africa Time. */
export function isInAcademicYear(iso: string | null | undefined, year: AcademicYearSelection): boolean {
  if (!iso) return false;
  if (year === "all") return true;
  const time = new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : iso).getTime();
  if (Number.isNaN(time)) return false;
  const { startIso, endIso } = academicYearRange(year);
  return time >= new Date(startIso).getTime() && time < new Date(endIso).getTime();
}

/** Narrows a Supabase query to the selected year on the given timestamp column. */
export function filterByAcademicYear<Q>(query: Q, selection: AcademicYearSelection, column = "created_at"): Q {
  if (selection === "all") return query;
  const { startIso, endIso } = academicYearRange(selection);
  const builder = query as {
    gte(column: string, value: string): { lt(column: string, value: string): Q };
  };
  return builder.gte(column, startIso).lt(column, endIso);
}
