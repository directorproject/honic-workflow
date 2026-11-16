/**
 * Heading-based extraction of common FYP / report sections from PDF plain text.
 * Tuned for DIT-style chapter wording (problem, objectives, limitations).
 */

/** Max bibliography entries shown on a title page (from the source report). */
export const MAX_TITLE_REFERENCES = 5;

export type PdfSections = {
  problemStatement: string | null;
  objectives: string | null;
  specificObjectives: string | null;
  limitations: string | null;
  /** Up to MAX_TITLE_REFERENCES citation lines from the report REFERENCES chapter. */
  references: string | null;
};

const PROBLEM_HEADINGS =
  /(?:statement\s+of\s+the\s+problem|problem\s+statement|(?:1\.\s*[23]|1\.[23])\s+(?:statement\s+of\s+the\s+)?problem(?:\s+statement)?)\b/i;
const SPECIFIC_OBJ_HEADINGS =
  /(?:specific\s+objectives?|(?:1\.\s*3\.\s*2|1\.3\.2)\s*(?:specific\s+objectives?)?|particular\s+objectives?)\b/i;
const RECOMMENDATION_HEADINGS =
  /(?:recommendations?|suggestion(?:s)?\s+for\s+(?:further|future)\s+(?:work|study|research)|future\s+work)\b/i;
const LIMIT_HEADINGS =
  /(?:limitations?\s+of\s+(?:the\s+)?(?:study|project|research)|project\s+limitations?|project\s+weakness(?:es)?|weakness(?:es)?\s+of\s+(?:the\s+)?(?:study|project)|delimitations?|scope\s+and\s+limitations?(?:\s+of\s+(?:the\s+)?project)?)\b/i;
const ABSTRACT_HEADING = /\babstract\b/i;

const NEXT_SECTION =
  /\n\s*(?:(?:\d+(?:\.\d+){1,3}\.?\s+)(?:[A-Z][A-Za-z].{0,90}|problem|objective|limitation|recommendation|weakness|delimitation|organization|scope|significance|chapter)|(?:\d+(?:\.\d+)*\.?\s+)?(?:REFERENCES|BIBLIOGRAPHY|LIST OF REFERENCES)\b|\n\s*\[\d{1,2}\]\s+(?=[A-Za-z"'(\[])|(?:\d+(?:\.\d+)*\.?\s+)?(?:APPENDIX|APPENDICES|ANNEX)\b)/i;

/** Cut recommendations/limitations body before bibliography chapters bleed in from PDF extraction. */
export function truncateBeforeBibliography(text: string): string {
  let body = String(text || "").replace(/\r/g, "\n");
  const cuts = [
    /\n\s*(?:\d+(?:\.\d+)*\.?\s+)?(?:REFERENCES|BIBLIOGRAPHY|LIST OF REFERENCES|WORKS CITED)\b/i,
    /\n\s*\[\d{1,2}\]\s+(?=[A-Za-z"'(\[])/,
    /\n\s*(?:\d+(?:\.\d+)*\.?\s+)?(?:APPENDIX|APPENDICES|ANNEX|GLOSSARY)\b/i,
  ];
  for (const re of cuts) {
    const idx = body.search(re);
    if (idx > 48) body = body.slice(0, idx);
  }
  return body.trim();
}

function clean(text: string, max = 4000): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, max);
}

const FIGURE_CAPTION =
  /^(?:figure|fig\.?|table|plate|chart|graph|equation|eq\.?)\s*[\d.]+(?:\s*[:.)\-–—].*)?$/i;
const LIST_ITEM = /^\s*(?:[\(\[]?[ivx0-9]+[\)\].:]|[•\-–—*]|\([a-z]\))\s+/i;

function isArtifactLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true; // bare page numbers
  if (/^\[\d{1,3}\]$/.test(t)) return true;
  if (FIGURE_CAPTION.test(t)) return true;
  if (/^(?:figure|fig\.?|table)\s*[\d.]+\b/i.test(t) && t.length < 160) return true;
  if (/^source\s*:/i.test(t)) return true;
  return false;
}

function joinSoftWrappedLines(lines: string[]): string {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || isArtifactLine(line)) continue;
    const prev = out[out.length - 1];
    if (
      prev &&
      !LIST_ITEM.test(prev) &&
      !LIST_ITEM.test(line) &&
      !/[.!?…:]$/.test(prev) &&
      !/^[A-Z][A-Z\s]{8,}$/.test(line) &&
      line[0] === line[0]?.toLowerCase()
    ) {
      out[out.length - 1] = `${prev} ${line}`;
      continue;
    }
    // Caption fragments that leaked mid-paragraph
    if (/^(?:of water in fuel|on the engine|in fuel combustion|cylinder)\b/i.test(line)) continue;
    out.push(line);
  }
  return out.join("\n");
}

function formatSpecificObjectives(text: string): string {
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !isArtifactLine(l));
  const body = lines.filter(
    (l) => !/^(?:below are|the following are|specific objectives?\s*[:.]?\s*$)/i.test(l),
  );
  const items: string[] = [];
  for (const line of body) {
    if (LIST_ITEM.test(line)) {
      items.push(line.replace(LIST_ITEM, "").trim());
      continue;
    }
    // Continuation of previous objective
    if (items.length && !/[.!?]$/.test(items[items.length - 1]!) && line[0] === line[0]?.toLowerCase()) {
      items[items.length - 1] = `${items[items.length - 1]} ${line}`;
      continue;
    }
    if (items.length) items.push(line);
    else items.push(line);
  }
  const cleaned = items
    .map((item) => item.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim())
    .filter((item) => item.length >= 8);
  if (cleaned.length >= 2) {
    return cleaned.map((item, i) => `${i + 1}. ${item.replace(/^[a-z]/, (c) => c.toUpperCase())}`).join("\n");
  }
  return joinSoftWrappedLines(body);
}

/**
 * Strip PDF artifacts (figure captions, page numbers) and tidy prose for portal display.
 */
export function polishBriefText(
  text: string | null | undefined,
  kind: "problem" | "main" | "specific" | "recommendations" | "generic" = "generic",
): string | null {
  if (typeof text !== "string") return null;
  let raw = text.replace(/\u0000/g, "").replace(/\r/g, "\n").trim();
  if (!raw) return null;
  if (kind === "recommendations") raw = truncateBeforeBibliography(raw);

  // Drop inline figure captions that sit mid-block
  raw = raw.replace(
    /(?:^|\n)\s*(?:Figure|Fig\.?|Table)\s*[\d.]+\s*[:.)\-–—][^\n]*/gi,
    "\n",
  );
  raw = raw.replace(/(?:^|\n)\s*\[\d{1,3}\]\s*(?=\n|$)/g, "\n");
  raw = raw.replace(/(?:^|\n)\s*\d{1,3}\s*(?=\n|$)/g, "\n");

  let polished =
    kind === "specific"
      ? formatSpecificObjectives(raw)
      : joinSoftWrappedLines(raw.split("\n"));

  polished = polished
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (kind === "problem" || kind === "main" || kind === "recommendations") {
    // Prefer continuous paragraphs over ragged caption leftovers
    polished = polished
      .split(/\n+/)
      .filter((line) => !FIGURE_CAPTION.test(line.trim()))
      .join(kind === "main" ? " " : "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  if (kind === "main") {
    polished = polished.replace(/^(?:the\s+)?(?:main|general|overall)\s+objectives?\s*[:.]?\s*/i, "").trim();
  }

  if (polished.length < 12) return null;
  return polished.slice(0, kind === "specific" ? 4000 : 3500);
}

/** Normalize bibliography text into at most MAX_TITLE_REFERENCES numbered lines. */
export function polishReferencesText(text: string | null | undefined): string | null {
  if (typeof text !== "string") return null;
  let raw = text.replace(/\u0000/g, "").replace(/\r/g, "\n").trim();
  if (!raw) return null;

  raw = raw.replace(/(?:^|\n)\s*(?:Figure|Fig\.?|Table)\s*[\d.]+\s*[:.)\-–—][^\n]*/gi, "\n");
  raw = raw.replace(/(?:^|\n)\s*\d{1,3}\s*(?=\n|$)/g, "\n");

  const chunks: string[] = [];
  if (/\[\d+\]/.test(raw)) {
    for (const part of raw.split(/(?=\[\d+\])/)) {
      const t = part.replace(/\s+/g, " ").replace(/^\[\d+\]\s*/, "").trim();
      if (t.length >= 18) chunks.push(t);
    }
  } else {
    const stripEntryMarker = (line: string) => {
      // Prefer arabic "1." / "1)" markers so author initials like "I. Smith" stay intact.
      if (/^\d+\s*[.)]\s+\S/.test(line)) return line.replace(/^\d+\s*[.)]\s*/, "").trim();
      if (LIST_ITEM.test(line)) return line.replace(LIST_ITEM, "").trim();
      return line.trim();
    };
    const lines = raw.split(/\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    let current = "";
    for (const line of lines) {
      if (isArtifactLine(line)) continue;
      if (/^(?:references?|bibliography|list of references)\b/i.test(line)) continue;
      if (/^(?:\d+(?:\.\d+)*\.?\s+)?(?:appendix|appendices|annex)\b/i.test(line)) break;
      const startsEntry =
        /^\d+\s*[.)]\s+\S/.test(line) ||
        LIST_ITEM.test(line) ||
        (/^[A-Z][A-Za-z'’.-]+(?:,|\s+and\s|\s+[A-Z]\.)/.test(line) && current.length > 40);
      if (startsEntry && current) {
        chunks.push(current);
        current = stripEntryMarker(line);
      } else {
        current = current ? `${current} ${line}` : stripEntryMarker(line);
      }
    }
    if (current.length >= 18) chunks.push(current);
  }

  const unique: string[] = [];
  for (const c of chunks) {
    const cleaned = c.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
    if (cleaned.length < 18) continue;
    if (unique.some((u) => u.slice(0, 48).toLowerCase() === cleaned.slice(0, 48).toLowerCase())) continue;
    unique.push(cleaned.slice(0, 500));
    if (unique.length >= MAX_TITLE_REFERENCES) break;
  }
  if (!unique.length) return null;
  return unique.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

export function polishPdfSections(sections: PdfSections): PdfSections {
  return {
    problemStatement: polishBriefText(sections.problemStatement, "problem"),
    objectives: polishBriefText(sections.objectives, "main"),
    specificObjectives: polishBriefText(sections.specificObjectives, "specific"),
    limitations: polishBriefText(sections.limitations, "recommendations"),
    references: polishReferencesText(sections.references),
  };
}

/** Pull up to MAX_TITLE_REFERENCES entries from the REFERENCES / bibliography chapter. */
export function extractReferencesFromPdf(rawText: string): string | null {
  const text = stripTocLines(
    rawText
      .replace(/\r/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\b((?:[A-Za-z] ){4,}[A-Za-z])\b/g, (m) => m.replace(/ /g, "")),
  );
  // Accept "9 REFERENCES", "CHAPTER 9 REFERENCES", then newline or [1].
  const heading =
    /(?:^|\n)\s*(?:(?:chapter|ch\.?)\s+)?(?:\d+(?:\.\d+)*\.?\s+)?(?:REFERENCES|BIBLIOGRAPHY|LIST OF REFERENCES|WORKS\s+CITED|LITERATURE\s+CITED)\b\s*(?=\n|:|\[)/gi;
  let lastEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = heading.exec(text))) {
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd < 0) {
    const bracket = [
      ...text.matchAll(
        /\[\d+\]\s+\S[\s\S]{20,800}?(?=\n\s*\[\d+\]|\n\s*(?:\d+(?:\.\d+)*\.?\s+)?(?:APPENDIX|APPENDICES|ANNEX)\b|$)/gi,
      ),
    ];
    if (bracket.length >= 2) {
      const start = bracket[0].index ?? -1;
      if (start >= 0) return polishReferencesText(text.slice(start, start + 12_000));
    }
    return null;
  }

  let body = text.slice(lastEnd);
  // "10 APPENDICES" / "APPENDIX A" often follow the bibliography.
  const stop = body.search(/\n\s*(?:\d+(?:\.\d+)*\.?\s+)?(?:APPENDIX|APPENDICES|ANNEX|GLOSSARY)\b/i);
  if (stop > 40) body = body.slice(0, stop);
  body = body.slice(0, 12_000);
  return polishReferencesText(body);
}

function sliceUntilNext(text: string, start: number): string {
  if (start < 0 || start >= text.length) return "";
  const rest = text.slice(start);
  const next = rest.search(NEXT_SECTION);
  const end = next > 12 ? next : Math.min(rest.length, 2200);
  return clean(rest.slice(0, end));
}

function isTocJunk(body: string): boolean {
  const letters = (body.match(/[A-Za-z]/g) || []).length;
  const dotChars = (body.match(/\./g) || []).length;
  if (letters < 40) return true;
  if (dotChars > letters) return true;
  if (dotChars > body.length * 0.35) return true;
  return false;
}

function extractByHeadings(text: string, heading: RegExp): string | null {
  const re = new RegExp(`(?:^|\\n)\\s*(?:\\d+(?:\\.\\d+)*\\.?\\s+)?${heading.source}\\s*(?:\\n|:|\\-|–)?`, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const body = sliceUntilNext(text, match.index + match[0].length);
    if (body.length >= 20 && !isTocJunk(body)) return body;
  }
  return null;
}

/** Prefer specific-objectives block cut from a combined objectives section. */
function splitObjectives(block: string | null): { main: string | null; specific: string | null } {
  if (!block) return { main: null, specific: null };
  const specificAt = block.search(/\n\s*(?:specific\s+objectives?|the\s+specific\s+objectives?)\b/i);
  if (specificAt > 20) {
    return {
      main: clean(block.slice(0, specificAt), 2000) || null,
      specific: clean(block.slice(specificAt).replace(/^[^\n]*\n/, ""), 3000) || null,
    };
  }
  // Numbered list often means specific objectives only
  if (/^\s*[\(]?[1iI][\).\]]/m.test(block) && (block.match(/^\s*[\(]?\d/gm) ?? []).length >= 2) {
    return { main: null, specific: clean(block, 3000) };
  }
  return { main: clean(block, 2000), specific: null };
}

/** Drop table-of-contents lines (leader dots / dotted leaders). */
function stripTocLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      if (/\.{5,}/.test(line)) return false;
      if (/[·.……]{3,}/.test(line)) return false;
      const dots = (line.match(/\./g) || []).length;
      if (dots > Math.max(8, line.length * 0.25)) return false;
      return true;
    })
    .join("\n");
}

export function extractPdfSections(rawText: string): PdfSections {
  // Keep newlines; collapse only extreme runs of spaces; remove TOC leaders.
  const text = stripTocLines(rawText.replace(/\r/g, "\n").replace(/[ \t]{2,}/g, " "));

  let problemStatement = extractByHeadings(text, PROBLEM_HEADINGS);
  if (!problemStatement) {
    const abs = extractByHeadings(text, ABSTRACT_HEADING);
    if (abs && abs.length >= 40) problemStatement = clean(abs.split(/\n/)[0] ?? abs, 1600);
  }

  let specificObjectives = extractByHeadings(text, SPECIFIC_OBJ_HEADINGS);
  let objectives =
    extractByHeadings(text, /(?:general\s+objectives?|main\s+objectives?|overall\s+objectives?)\b/i) ??
    extractByHeadings(text, /(?:1\.\s*4\.\s*1|1\.4\.1)\s+main\s+objectives?\b/i) ??
    extractByHeadings(text, /aim\s+of\s+(?:the\s+)?(?:study|project)\b/i);

  if (!objectives) {
    const block =
      extractByHeadings(text, /(?:1\.\s*4|1\.4)\s+objectives?\b/i) ??
      extractByHeadings(text, /(?:1\.\s*3|1\.3)\s+objectives?\b/i);
    if (block) {
      const split = splitObjectives(block);
      objectives = split.main;
      if (!specificObjectives) specificObjectives = split.specific;
      if (!objectives) {
        const beforeList = block.split(/\n\s*(?:specific\s+objectives?|1\.\s)/i)[0]?.trim();
        if (beforeList && beforeList.length >= 20) objectives = clean(beforeList, 1200);
      }
    }
  }

  if (!specificObjectives && objectives) {
    const split = splitObjectives(objectives);
    if (split.specific) {
      objectives = split.main ?? objectives;
      specificObjectives = split.specific;
    }
  }

  if (!objectives && specificObjectives) {
    const firstLine = specificObjectives.split(/\n/).find((l) => l.trim().length > 20);
    if (firstLine && !/^\s*[\(]?\d/.test(firstLine)) {
      objectives = clean(firstLine, 800);
    }
  }

  // Prefer Recommendations chapter; fall back to limitations if recommendations missing.
  const limitationsRaw =
    extractByHeadings(text, RECOMMENDATION_HEADINGS) ??
    extractByHeadings(text, /(?:6\.\s*3|6\.3|7\.\s*2|7\.2|5\.\s*3|5\.3)\s+recommendations?\b/i) ??
    extractByHeadings(text, LIMIT_HEADINGS) ??
    extractByHeadings(text, /(?:1\.\s*6(?:\.\s*2)?|1\.6(?:\.2)?)\s+limitations?\s+of\s+(?:the\s+)?project\b/i) ??
    extractByHeadings(text, /limitation\s+of\s+(?:the\s+)?project\b/i);
  const limitations = limitationsRaw ? truncateBeforeBibliography(limitationsRaw) : null;

  const references = extractReferencesFromPdf(rawText);

  return polishPdfSections({
    problemStatement,
    objectives,
    specificObjectives,
    limitations,
    references,
  });
}

/** Merge PDF sections into markdown notes used by parseTitleBrief (no literature URLs). */
export function mergeSectionsIntoNotes(
  existingNotes: string | null | undefined,
  sections: PdfSections,
): string {
  const brief = parseNotesLoose(existingNotes);
  const problem = sections.problemStatement ?? brief.problem;
  const main = sections.objectives ?? brief.main;
  const specific = sections.specificObjectives ?? brief.specific;
  const limits = sections.limitations ?? brief.limits;
  const refs = sections.references ?? brief.references;

  const polished = polishPdfSections({
    problemStatement: problem,
    objectives: main,
    specificObjectives: specific,
    limitations: limits,
    references: refs,
  });

  const parts: string[] = ["## Enriched from PDF"];
  if (polished.problemStatement) parts.push(`## Problem statement\n${polished.problemStatement}`);
  if (polished.objectives) parts.push(`## Main objective\n${polished.objectives}`);
  if (polished.specificObjectives) parts.push(`## Specific objectives\n${polished.specificObjectives}`);
  if (polished.limitations) parts.push(`## Recommendations\n${polished.limitations}`);
  if (polished.references) parts.push(`## References\n${polished.references}`);
  return parts.join("\n\n");
}

function parseNotesLoose(notes: string | null | undefined) {
  const raw = typeof notes === "string" ? notes.trim() : "";
  const section = (heading: string) => {
    const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const match = raw.match(re);
    const body = match?.[1]?.trim() ?? "";
    return body || null;
  };
  return {
    problem: section("Problem statement"),
    main: section("Main objective"),
    specific: section("Specific objectives"),
    limits:
      section("Recommendations") ??
      section("Project limitations") ??
      section("Project weakness") ??
      section("Limitations"),
    references: section("References"),
    literature: section("Literature and source"),
  };
}
