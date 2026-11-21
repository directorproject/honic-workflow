/**
 * Cohort / level key for the portal titles “Level” filter and catalogue citations.
 * Recognises BEng intakes (BENG22, including glued forms like BENG22ETE) and OD /
 * lab-tech cohorts so diploma final-year titles are not forced into a BENG bucket.
 */

export type TitleCohortKind = "beng" | "od" | "labtech" | "other";

export type TitleCohort = {
  /** Stable filter value, e.g. BENG22, OD-NTA6, BT22LS */
  key: string;
  /** Short label for the Level dropdown */
  label: string;
  kind: TitleCohortKind;
  /** Intake calendar year for BENG## (e.g. 2022), else null */
  intakeYear: number | null;
};

function blobOf(batch: string | null | undefined, source: string | null | undefined): string {
  return `${batch ?? ""} ${source ?? ""}`.replace(/\s+/g, " ").trim();
}

/** BENG22 or BENG 22, including glued BENG22ETE / BENG22COE. */
const BENG_RE = /\bBENG\s*(\d{2})(?!\d)/i;

/**
 * Typical DIT BEng FYP academic-year start = intake year + 3
 * (BENG22 → 2025/2026).
 */
export function academicYearStartFromBengKey(key: string): number | null {
  const m = /^BENG(\d{2})$/i.exec(key);
  if (!m) return null;
  return 2000 + Number(m[1]) + 3;
}

/** Prefer an explicit 20xx/20xx (or 20xx20xx) on the title list text. */
export function academicYearStartFromListText(text: string | null | undefined): number | null {
  if (!text?.trim()) return null;
  const labeled = text.match(/(20\d{2})\s*\/\s*(20\d{2})/);
  if (labeled) return Number(labeled[1]);
  const glued = text.match(/\b(20\d{2})(20\d{2})\b/);
  if (glued && Number(glued[2]) === Number(glued[1]) + 1) return Number(glued[1]);
  return null;
}

/**
 * Derive a cohort key from title batch / origin text.
 * Returns null only when there is no usable signal (caller may leave unfiltered).
 */
export function titleCohortFromText(
  batch: string | null | undefined,
  source?: string | null,
): TitleCohort | null {
  const blob = blobOf(batch, source);
  if (!blob) return null;

  const beng = blob.match(BENG_RE);
  if (beng) {
    const key = `BENG${beng[1]}`;
    const intakeYear = 2000 + Number(beng[1]);
    return { key, label: key, kind: "beng", intakeYear };
  }

  const btLs = blob.match(/\bBT\s*(\d{2})\s*LS\b/i) || blob.match(/\bBT(\d{2})LS\b/i);
  if (btLs || /\bLab Tech\b/i.test(blob) || /\bLaboratory Science\b/i.test(blob)) {
    const key = btLs ? `BT${btLs[1]}LS` : "BT-LS";
    return { key, label: `${key} Lab Tech`, kind: "labtech", intakeYear: null };
  }

  if (
    /\bNTA\s*L\s*6\b/i.test(blob) ||
    /\bNTA\s*Level\s*6\b/i.test(blob) ||
    /\bOrdinary Diploma\b/i.test(blob) ||
    /\bOD\b/.test(blob) ||
    /\bMini\s*(One|1|I)\b/i.test(blob)
  ) {
    return { key: "OD-NTA6", label: "OD · NTA Level 6", kind: "od", intakeYear: null };
  }

  return null;
}

export function titleCohortKey(
  batch: string | null | undefined,
  source?: string | null,
): string | null {
  return titleCohortFromText(batch, source)?.key ?? null;
}

/**
 * Best academic-year start for a catalogue title: list year on batch/origin,
 * then BENG intake+3, else null (caller may fall back to upload date).
 */
export function academicYearStartForTitle(opts: {
  batch?: string | null;
  source?: string | null;
  originRef?: string | null;
}): number | null {
  const fromBatch = academicYearStartFromListText(opts.batch);
  if (fromBatch != null) return fromBatch;
  const fromSource = academicYearStartFromListText(opts.source);
  if (fromSource != null) return fromSource;
  const fromOrigin = academicYearStartFromListText(opts.originRef);
  if (fromOrigin != null) return fromOrigin;

  const cohort = titleCohortFromText(opts.batch, opts.source ?? opts.originRef);
  if (cohort?.kind === "beng") {
    return academicYearStartFromBengKey(cohort.key);
  }
  return null;
}
