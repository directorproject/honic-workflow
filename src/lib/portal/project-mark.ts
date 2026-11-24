import { INSTITUTIONS } from "@/lib/portal/config";
import {
  academicYearStartForTitle,
  titleCohortFromText,
} from "@/lib/portal/title-cohort";

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
const BENG_MODULE: Record<string, { module: string; label: string }> = {
  COE: { module: "COU 08204", label: "Project Realization" },
  EE: { module: "EEU 08205", label: "Project Realization" },
  ETE: { module: "ETU 08221", label: "Project Realization" },
};

/** OD / diploma final-year modules — same code pattern as BEng Project Realization. */
const OD_MODULE: Record<string, { module: string; label: string }> = {
  ETE: { module: "ETU 06204", label: "Final year project" },
  /** Ordinary Diploma in Communication System Technology (not BEng ETE). */
  CST: { module: "CST 06212", label: "Project Realization" },
  COE: { module: "COU 06204", label: "Final year project" },
  EE: { module: "EEU 06205", label: "Final year project" },
  SLT: { module: "LSU 08106", label: "Final year project" },
};
const OD_MODULE_DEFAULT = { module: "PRJ 06200", label: "Final year project" };
const LAB_MODULE = { module: "LSU 08106", label: "Final year project" };

const TZ_INSTITUTION_SET = new Set(INSTITUTIONS.map((name) => name.toLowerCase()));

/**
 * Tanzania catalogue titles → Final year project.
 * Outsourced / foreign lists (Kaggle, AISSMS, Amrita, …) → New project title.
 */
export function isTanzanianCatalogueTitle(item: {
  institution: string | null;
  batch: string | null;
  source: string | null;
}): boolean {
  const inst = item.institution?.trim() ?? "";
  if (inst) {
    if (TZ_INSTITUTION_SET.has(inst.toLowerCase())) return true;
    if (/tanzania|\(dit\)\s*$|dar es salaam institute of technology/i.test(inst)) return true;
  }

  const blob = `${item.batch ?? ""} ${item.source ?? ""}`;
  if (
    /\bDIT\b/i.test(blob) ||
    /\bBENG\s*\d{2}/i.test(blob) ||
    /\bBT\d{2}LS\b/i.test(blob) ||
    /\bOD NTA\b/i.test(blob) ||
    /\bLab Tech\b/i.test(blob) ||
    /\bLaboratory Science\b/i.test(blob)
  ) {
    return true;
  }

  // Explicit outsourced markers
  if (/kaggle|aissms|amrita|nitt|mgit|biet|abroad|india|foreign/i.test(blob)) return false;

  return false;
}

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

function programmeOf(item: { courseCode: string | null; source: string | null; batch: string | null }): string {
  const code = item.courseCode?.trim().toUpperCase();
  // CST = OD Communication System Technology — keep separate from BEng/OD ETE.
  if (code && (BENG_MODULE[code] || OD_MODULE[code] || code === "SLT")) return code;
  const blob = `${item.source ?? ""} ${item.batch ?? ""}`;
  if (/\bCST\b/i.test(blob) || /\bCommunication System Technology\b/i.test(blob)) return "CST";
  if (/\bCOE\b/i.test(blob)) return "COE";
  if (/\bETE\b/i.test(blob)) return "ETE";
  if (/\bEE\b/i.test(blob)) return "EE";
  if (/\bSLT\b|\bLab Tech\b|\bLaboratory Science\b/i.test(blob)) return "SLT";
  return code || "ETE";
}

function citationYear(item: {
  source: string | null;
  batch: string | null;
  yearLabel: string;
}): string {
  const fromTitle = academicYearStartForTitle({ batch: item.batch, source: item.source });
  if (fromTitle != null) return `${fromTitle}/${fromTitle + 1}`;
  return academicYear(item.yearLabel) ?? item.yearLabel;
}

function catalogueLine(item: {
  courseCode: string | null;
  source: string | null;
  batch: string | null;
  yearLabel: string;
  institution: string | null;
  tanzanian: boolean;
}): { citation: string; code: string; category: string; programme: string } {
  const programme = programmeOf(item);
  const year = citationYear(item);
  const cohort = titleCohortFromText(item.batch, item.source);

  if (!item.tanzanian) {
    const label = item.batch?.trim() || "Outsourced catalogue";
    return {
      citation: `New project title · ${label} (${year})`,
      code: "NEW",
      category: "New project title",
      programme,
    };
  }

  // OD / diploma — final year project with programme module code (never invent a BENG## citation)
  if (cohort?.kind === "od") {
    const courseModule = OD_MODULE[programme] ?? OD_MODULE_DEFAULT;
    const citation = `${cohort.key} ${programme} ${courseModule.label} ${courseModule.module} (${year})`;
    return { citation, code: courseModule.module, category: courseModule.label, programme };
  }

  if (cohort?.kind === "labtech") {
    const citation = `${cohort.key} SLT ${LAB_MODULE.label} ${LAB_MODULE.module} (${year})`;
    return { citation, code: LAB_MODULE.module, category: LAB_MODULE.label, programme: "SLT" };
  }

  const courseModule = BENG_MODULE[programme] ?? { module: "PRJ 08200", label: "Project Realization" };
  const bengLabel = cohort?.kind === "beng" ? cohort.key : "BEng";
  const citation = `${bengLabel} ${programme} ${courseModule.label} ${courseModule.module} (${year})`;
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
  const fromTitle = academicYearStartForTitle({ batch: item.batch, source: item.source });
  const year = fromTitle != null ? String(fromTitle) : yearPart(item.yearLabel);
  const courseCode = item.courseCode?.trim().toUpperCase() || null;
  const tanzanian = item.kind === "earlier" || isTanzanianCatalogueTitle(item);
  const institute = shortInstitution(item.institution) ?? (tanzanian ? "DIT" : null);
  const catalogue = catalogueLine({ ...item, tanzanian });

  if (tanzanian) {
    return {
      year,
      courseCode: courseCode ?? catalogue.programme,
      institute,
      code: catalogue.code,
      category: catalogue.category,
      group: "Final year project",
      citation: catalogue.citation,
      note:
        item.kind === "earlier"
          ? "Use this earlier final year title as reference. Review the method and findings, identify what remains open, and build on that gap."
          : "Use this title as a starting point for your final year project. Study the gap, then change the project before you submit it.",
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
    note: "Use this title as a starting point for your final year project. Study the gap, then change the project before you submit it.",
  };
}
