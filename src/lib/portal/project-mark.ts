export type ProjectMark = {
  year: string;
  courseCode: string | null;
  institute: string | null;
  /** Short module code, for example COU 08204. */
  code: string;
  /** The kind of work shown next to the code. */
  category: string;
  /** Group name used in the list header. */
  group: "Final year project" | "New project title";
  /** Full catalogue line, for example BENG22 COE Project Realization COU 08204 (2025/2026). */
  citation: string;
  note: string;
};

/** DIT Bachelor of Engineering Project Realization modules from the 2025/2026 prospectus. */
const MODULE: Record<string, { module: string; label: string }> = {
  COE: { module: "COU 08204", label: "Project Realization" },
  EE: { module: "EEU 08205", label: "Project Realization" },
  ETE: { module: "ETU 08221", label: "Project Realization" },
};

export function shortInstitution(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const named = value.match(/\(([A-Za-z0-9.-]+)\)\s*$/);
  if (named) return named[1].toUpperCase();
  const words = value.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 8).toUpperCase();
  return words
    .filter((word) => !/^(of|and|the|for|in)$/i.test(word))
    .map((word) => word[0])
    .join("")
    .slice(0, 8)
    .toUpperCase();
}

function yearPart(yearLabel: string): string {
  const match = /^(20\d{2})\/(20\d{2})$/.exec(yearLabel);
  if (match) return match[1];
  const one = /(20\d{2})/.exec(yearLabel);
  return one?.[1] ?? "—";
}

function academicYear(yearLabel: string): string | null {
  const match = /^(20\d{2})\/(20\d{2})$/.exec(yearLabel);
  if (match) return `${match[1]}/${match[2]}`;
  const one = /(20\d{2})/.exec(yearLabel);
  if (!one) return null;
  const start = Number(one[1]);
  return `${start}/${start + 1}`;
}

function cohortFromText(text: string | null, yearLabel: string): string {
  const fromText = text?.match(/\b(BENG\s*\d{2})\b/i)?.[1];
  if (fromText) return fromText.replace(/\s+/g, "").toUpperCase();
  const start = yearPart(yearLabel);
  if (/^20\d{2}$/.test(start)) {
    const cohortYear = Number(start) - 3;
    return `BENG${String(cohortYear).slice(2)}`;
  }
  return "BENG";
}

function programmeOf(item: { courseCode: string | null; source: string | null; batch: string | null }): string {
  const code = item.courseCode?.trim().toUpperCase();
  if (code && MODULE[code]) return code;
  const blob = `${item.source ?? ""} ${item.batch ?? ""}`;
  if (/\bCOE\b/i.test(blob)) return "COE";
  if (/\bETE\b/i.test(blob)) return "ETE";
  if (/\bEE\b/i.test(blob)) return "EE";
  return code || "EE";
}

function catalogueLine(item: {
  courseCode: string | null;
  source: string | null;
  batch: string | null;
  yearLabel: string;
}): { citation: string; code: string; category: string; programme: string } {
  const programme = programmeOf(item);
  const courseModule = MODULE[programme] ?? { module: "PRJ 08200", label: "Project Realization" };
  const year = academicYear(item.yearLabel) ?? item.yearLabel;
  const cohort = cohortFromText(item.source ?? item.batch, item.yearLabel);
  const citation = `${cohort} ${programme} ${courseModule.label} ${courseModule.module} (${year})`;
  return { citation, code: courseModule.module, category: courseModule.label, programme };
}

export function projectMark(item: {
  kind: "earlier" | "study";
  source: string | null;
  batch: string | null;
  yearLabel: string;
  courseCode: string | null;
  institution: string | null;
}): ProjectMark {
  const year = yearPart(item.yearLabel);
  const courseCode = item.courseCode?.trim().toUpperCase() || null;
  const institute = shortInstitution(item.institution) ?? "DIT";
  const catalogue = catalogueLine(item);

  if (item.kind === "earlier") {
    return {
      year,
      courseCode: courseCode ?? catalogue.programme,
      institute,
      code: catalogue.code,
      category: catalogue.category,
      group: "Final year project",
      citation: catalogue.citation,
      note: "Use this title as literature. Review the method and findings, identify what remains open, and build on that gap.",
    };
  }

  return {
    year,
    courseCode: courseCode ?? catalogue.programme,
    institute,
    code: catalogue.code,
    category: catalogue.category,
    group: "New project title",
    citation: catalogue.citation,
    note: "Use this title as a starting point for literature review. Study the gap, then change the project before you submit it.",
  };
}
