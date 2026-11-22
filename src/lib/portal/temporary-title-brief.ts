export const TEMPORARY_BRIEF_MARKER = "## Temporary brief";
export const PDF_ENRICHED_MARKER = "## Enriched from PDF";

export function isTemporaryBrief(notes: string | null | undefined): boolean {
  return /##\s*Temporary brief\b/i.test(String(notes ?? ""));
}

export function isPdfEnrichedBrief(notes: string | null | undefined): boolean {
  return /##\s*Enriched from PDF\b/i.test(String(notes ?? ""));
}

function hasSection(notes: string, heading: string): boolean {
  const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const body = notes.match(re)?.[1]?.trim() ?? "";
  return body.length >= 20;
}

/** True when problem / main / specific are all present in notes. */
export function briefHasCoreSections(notes: string | null | undefined): boolean {
  const raw = String(notes ?? "");
  return (
    hasSection(raw, "Problem statement") &&
    hasSection(raw, "Main objective") &&
    hasSection(raw, "Specific objectives")
  );
}

function cleanTitle(title: string): string {
  return String(title ?? "").replace(/\s+/g, " ").trim();
}

function topicFromTitle(title: string): string {
  return cleanTitle(title)
    .replace(/^(design(?:ing)?|development|implementation|construction|building)\s+(of\s+|an\s+|a\s+)?/i, "")
    .replace(/^(an|a|the)\s+/i, "")
    .trim();
}

function literatureSection(existingNotes: string | null | undefined): string | null {
  const raw = String(existingNotes ?? "");
  const match = raw.match(/##\s*Literature and source\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  const body = match?.[1]?.trim();
  return body ? `## Literature and source\n${body}` : null;
}

/**
 * DIT-style starter brief (problem → main → specific), modelled on enriched PDF reports.
 * Marked so staff can delete it later and rewrite from an uploaded PDF.
 */
export function buildTemporaryTitleBrief(
  title: string,
  opts?: { summary?: string | null; existingNotes?: string | null },
): string {
  const fullTitle = cleanTitle(title) || "this project";
  const topic = topicFromTitle(fullTitle) || fullTitle;
  const summary = opts?.summary?.trim() || null;

  const problem = [
    summary && summary.length > 40 && !/starting title|read the attached|use this as/i.test(summary)
      ? summary
      : null,
    `In practice, work related to ${topic} is still done with limited monitoring, slow manual steps, or tools that do not fit local campus and community conditions.`,
    `Operators and users therefore face delays, weak records, and avoidable mistakes when they need timely and reliable information.`,
    `This project proposes ${fullTitle} so the same task can be handled with a clearer process, better feedback, and a prototype that can be tested in a Tanzanian institute or community setting.`,
  ]
    .filter(Boolean)
    .join(" ");

  const main = `To design, implement, and evaluate ${fullTitle} that addresses the gaps identified in the problem statement and can be demonstrated as a working prototype.`;

  const specific = [
    `1. Review related systems and prior student projects on ${topic}, and summarise the requirements for a local use case.`,
    `2. Specify sensors, control logic, interfaces, and power or network needs for the proposed solution.`,
    `3. Build and integrate a prototype that realises the main functions of ${topic}.`,
    `4. Test the prototype against the stated requirements, record results, and note limits.`,
    `5. Document findings, recommendations, and possible improvements for future work.`,
  ].join("\n");

  const parts = [
    TEMPORARY_BRIEF_MARKER,
    "Starter text for literature review. Replace this when a source PDF is uploaded.",
    "",
    "## Problem statement",
    problem,
    "",
    "## Main objective",
    main,
    "",
    "## Specific objectives",
    specific,
  ];

  const literature = literatureSection(opts?.existingNotes);
  if (literature) {
    parts.push("", literature);
  }

  return parts.join("\n");
}

export function temporaryBriefNeedsFill(notes: string | null | undefined): boolean {
  if (isPdfEnrichedBrief(notes)) return false;
  if (isTemporaryBrief(notes) && briefHasCoreSections(notes)) return false;
  return !briefHasCoreSections(notes);
}
