import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const TITLE_FILTER_ALL = "all";
export const TITLE_FILTER_NONE = "none";

export type TitleListFilters = {
  year: string;
  department: string;
  institution: string;
};

export const EMPTY_TITLE_LIST_FILTERS: TitleListFilters = {
  year: TITLE_FILTER_ALL,
  department: TITLE_FILTER_ALL,
  institution: TITLE_FILTER_ALL,
};

type ParamBag = URLSearchParams | { get(name: string): string | null };

export function parseTitleListFilters(params: ParamBag): TitleListFilters {
  const year = params.get("year");
  const department = params.get("department");
  const institution = params.get("institution");
  return {
    year: year && year.trim() ? year.trim() : TITLE_FILTER_ALL,
    department: department && department.trim() ? department.trim() : TITLE_FILTER_ALL,
    institution: institution && institution.trim() ? institution.trim() : TITLE_FILTER_ALL,
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
  };
}

export function titleListFiltersActive(filters: TitleListFilters): boolean {
  return (
    filters.year !== TITLE_FILTER_ALL ||
    filters.department !== TITLE_FILTER_ALL ||
    filters.institution !== TITLE_FILTER_ALL
  );
}

export function titleListFiltersQuery(filters: TitleListFilters): string {
  const params = new URLSearchParams();
  if (filters.year !== TITLE_FILTER_ALL) params.set("year", filters.year);
  if (filters.department !== TITLE_FILTER_ALL) params.set("department", filters.department);
  if (filters.institution !== TITLE_FILTER_ALL) params.set("institution", filters.institution);
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