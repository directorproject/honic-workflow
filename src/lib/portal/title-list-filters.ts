import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const TITLE_FILTER_ALL = "all";
export const TITLE_FILTER_NONE = "none";

export type TitleListFilters = {
  year: string;
  department: string;
  institution: string;
  level: string;
  /** Free-text keyword search (title, summary, course, institution, …). */
  q: string;
};

export const EMPTY_TITLE_LIST_FILTERS: TitleListFilters = {
  year: TITLE_FILTER_ALL,
  department: TITLE_FILTER_ALL,
  institution: TITLE_FILTER_ALL,
  level: TITLE_FILTER_ALL,
  q: "",
};

type ParamBag = URLSearchParams | { get(name: string): string | null };

function cleanQuery(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

export function parseTitleListFilters(params: ParamBag): TitleListFilters {
  const year = params.get("year");
  const department = params.get("department");
  const institution = params.get("institution");
  const level = params.get("level");
  const q = cleanQuery(params.get("q"));
  return {
    year: year && year.trim() ? year.trim() : TITLE_FILTER_ALL,
    department: department && department.trim() ? department.trim() : TITLE_FILTER_ALL,
    institution: institution && institution.trim() ? institution.trim() : TITLE_FILTER_ALL,
    level: level && level.trim() ? level.trim() : TITLE_FILTER_ALL,
    q,
  };
}

export function parseTitleListFiltersFromRecord(
  record: Record<string, string | string[] | undefined> | undefined,
): TitleListFilters {
  const pick = (key: string) => {
    const raw = record?.[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  return {
    year: pick("year") ?? TITLE_FILTER_ALL,
    department: pick("department") ?? TITLE_FILTER_ALL,
    institution: pick("institution") ?? TITLE_FILTER_ALL,
    level: pick("level") ?? TITLE_FILTER_ALL,
    q: cleanQuery(pick("q")),
  };
}

export function titleListFiltersActive(filters: TitleListFilters): boolean {
  return (
    filters.year !== TITLE_FILTER_ALL ||
    filters.department !== TITLE_FILTER_ALL ||
    filters.institution !== TITLE_FILTER_ALL ||
    filters.level !== TITLE_FILTER_ALL ||
    Boolean(filters.q)
  );
}

export function titleListFiltersQuery(filters: TitleListFilters): string {
  const params = new URLSearchParams();
  if (filters.year !== TITLE_FILTER_ALL) params.set("year", filters.year);
  if (filters.department !== TITLE_FILTER_ALL) params.set("department", filters.department);
  if (filters.institution !== TITLE_FILTER_ALL) params.set("institution", filters.institution);
  if (filters.level !== TITLE_FILTER_ALL) params.set("level", filters.level);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function titleListHref(filters: TitleListFilters = EMPTY_TITLE_LIST_FILTERS): string {
  return `/portal/titles${titleListFiltersQuery(filters)}`;
}

export function titleDetailHref(id: string, filters: TitleListFilters = EMPTY_TITLE_LIST_FILTERS): string {
  return `/portal/titles/${encodeURIComponent(id)}${titleListFiltersQuery(filters)}`;
}

export function titleDetailHrefWithNotice(id: string, notice: string, filters: TitleListFilters = EMPTY_TITLE_LIST_FILTERS): string {
  const params = new URLSearchParams();
  params.set("notice", notice);
  if (filters.year !== TITLE_FILTER_ALL) params.set("year", filters.year);
  if (filters.department !== TITLE_FILTER_ALL) params.set("department", filters.department);
  if (filters.institution !== TITLE_FILTER_ALL) params.set("institution", filters.institution);
  if (filters.level !== TITLE_FILTER_ALL) params.set("level", filters.level);
  if (filters.q) params.set("q", filters.q);
  return `/portal/titles/${encodeURIComponent(id)}?${params.toString()}`;
}

export function pushTitleListFilters(
  router: AppRouterInstance,
  pathname: string,
  next: Partial<TitleListFilters> & TitleListFilters,
) {
  if (pathname !== "/portal/titles") return;
  router.replace(titleListHref(next), { scroll: false });
}

/** Case-insensitive keyword match across common title fields. */
export function titleMatchesKeywordSearch(
  item: {
    title?: string | null;
    summary?: string | null;
    problemStatement?: string | null;
    courseCode?: string | null;
    institution?: string | null;
    batch?: string | null;
    source?: string | null;
    hardware?: string | null;
    communication?: string | null;
  },
  q: string,
): boolean {
  const needle = cleanQuery(q).toLowerCase();
  if (!needle) return true;
  const tokens = needle.split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const hay = [
    item.title,
    item.summary,
    item.problemStatement,
    item.courseCode,
    item.institution,
    item.batch,
    item.source,
    item.hardware,
    item.communication,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => hay.includes(token));
}
