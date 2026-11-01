import { cookies } from "next/headers";

import { ACADEMIC_YEAR_COOKIE, parseAcademicYearSelection, type AcademicYearSelection } from "@/lib/academic-year";

/** Year chosen in the dashboard header; defaults to the current working year. */
export async function getSelectedAcademicYear(): Promise<AcademicYearSelection> {
  const store = await cookies();
  return parseAcademicYearSelection(store.get(ACADEMIC_YEAR_COOKIE)?.value);
}
