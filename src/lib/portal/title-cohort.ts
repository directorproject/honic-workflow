/**
 * Cohort / level key for the portal titles “Level” filter and catalogue citations.
 * Recognises BEng intakes (BENG22) and diploma / mini / lab-tech cohorts so OD
 * rows are not forced into a BENG bucket.
 */

export type TitleCohortKind = "beng" | "od" | "labtech" | "other";

export type TitleCohort = {
  /** Stable filter value, e.g. BENG22, OD-NTA6, BT22LS */
  key: string;
  /** Short label for the Level dropdown */
  label: string;
  kind: TitleCohortKind;
};

function blobOf(batch: string | null | undefined, source: string | null | undefined): string {
  return `${batch ?? ""} ${source ?? ""}`.replace(/\s+/g, " ").trim();
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

  const beng = blob.match(/\bBENG\s*(\d{2})\b/i);
  if (beng) {
    const key = `BENG${beng[1]}`;
    return { key, label: key, kind: "beng" };
  }

  const btLs = blob.match(/\bBT\s*(\d{2})\s*LS\b/i) || blob.match(/\bBT(\d{2})LS\b/i);
  if (btLs || /\bLab Tech\b/i.test(blob) || /\bLaboratory Science\b/i.test(blob)) {
    const key = btLs ? `BT${btLs[1]}LS` : "BT-LS";
    return { key, label: `${key} Lab Tech`, kind: "labtech" };
  }

  if (
    /\bNTA\s*L\s*6\b/i.test(blob) ||
    /\bNTA\s*Level\s*6\b/i.test(blob) ||
    /\bOrdinary Diploma\b/i.test(blob) ||
    /\b\bOD\b/.test(blob) ||
    /\bMini\s*(One|1|I)\b/i.test(blob) ||
    /\bMini\s*project/i.test(blob)
  ) {
    return { key: "OD-NTA6", label: "OD · NTA Level 6", kind: "od" };
  }

  // Approved ETE/CST title lists without BENG token → treat as diploma/approved pool, not invented BENG
  if (/\bApproved titles\b/i.test(blob) && /\b(ETE|CST)\b/i.test(blob)) {
    return { key: "OD-NTA6", label: "OD · NTA Level 6", kind: "od" };
  }

  return null;
}

export function titleCohortKey(
  batch: string | null | undefined,
  source?: string | null,
): string | null {
  return titleCohortFromText(batch, source)?.key ?? null;
}
