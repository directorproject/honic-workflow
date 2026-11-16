import type { SupabaseClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { catalogueStoragePathFromUrl } from "@/lib/portal/document-access";
import { resolvePdfSections } from "@/lib/portal/gemini-extract-sections";
import { mergeSectionsIntoNotes } from "@/lib/portal/pdf-sections";
import type { ReviewItem } from "@/lib/portal/title-choices";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

const require = createRequire(import.meta.url);

export type PdfTextItem = { str?: string; width?: number; transform?: number[] };

/** Join glyphs using x-position so "F uel" style PDFs become readable words. */
function textFromContentItems(items: PdfTextItem[]): string {
  let out = "";
  let lastX: number | null = null;
  let lastY: number | null = null;
  for (const it of items) {
    const str = typeof it.str === "string" ? it.str : "";
    if (!str) continue;
    const x = Array.isArray(it.transform) ? Number(it.transform[4]) || 0 : 0;
    const y = Array.isArray(it.transform) ? Number(it.transform[5]) || 0 : 0;
    const w = typeof it.width === "number" ? it.width : Math.max(str.length * 4.5, 4);
    if (lastY != null && Math.abs(y - lastY) > 6) out += "\n";
    else if (lastX != null && x - lastX > Math.max(2.5, w * 0.35)) out += " ";
    out += str;
    lastX = x + w;
    lastY = y;
  }
  return out;
}

export async function pdfTextFromBytes(data: Uint8Array, maxPages = 14): Promise<string> {
  const pdfjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjs = await import(pathToFileURL(pdfjsPath).href);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let text = "";
  const n = Math.min(maxPages, doc.numPages);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += textFromContentItems(content.items as PdfTextItem[]) + "\n\n";
  }
  return text.replace(/\b((?:[A-Za-z] ){4,}[A-Za-z])\b/g, (m) => m.replace(/ /g, ""));
}

/**
 * Front matter (problem/objectives) + closing pages (recommendations),
 * so Gemini/regex can reach chapters near the end without reading every page.
 */
export async function pdfTextFromBytesHeadTail(
  data: Uint8Array,
  opts?: { headPages?: number; tailPages?: number },
): Promise<string> {
  const headPages = opts?.headPages ?? 28;
  const tailPages = opts?.tailPages ?? 18;
  const pdfjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjs = await import(pathToFileURL(pdfjsPath).href);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const total = doc.numPages;
  const pages = new Set<number>();
  for (let i = 1; i <= Math.min(headPages, total); i++) pages.add(i);
  for (let i = Math.max(1, total - tailPages + 1); i <= total; i++) pages.add(i);
  let text = "";
  for (const i of [...pages].sort((a, b) => a - b)) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += textFromContentItems(content.items as PdfTextItem[]) + "\n\n";
  }
  return text.replace(/\b((?:[A-Za-z] ){4,}[A-Za-z])\b/g, (m) => m.replace(/ /g, ""));
}

/** True when notes already contain a one-time PDF enrich marker. */
export function isBriefEnrichedFromPdf(notes: string | null | undefined): boolean {
  return /##\s*Enriched from PDF\b/i.test(String(notes ?? ""));
}

function needsEnrichment(item: ReviewItem, notes?: string | null): boolean {
  if (isBriefEnrichedFromPdf(notes)) return false;
  const weakObj = !item.objectives || /study and adapt|read the attached/i.test(item.objectives);
  const weakProblem =
    !item.problemStatement ||
    /BEng ETE project report|covers “|covers "|read the attached pdf|Open the attached PDF/i.test(
      item.problemStatement ?? "",
    );
  return weakProblem || weakObj || !item.specificObjectives || !item.limitations;
}

/**
 * One-time fill from catalogue PDF. Call from import / batch scripts — not on every page view.
 */
export async function enrichReviewItemFromCataloguePdf(
  db: SupabaseClient,
  item: ReviewItem,
  opts?: { notes?: string | null; force?: boolean },
): Promise<ReviewItem> {
  if (item.kind !== "study") return item;
  const storagePath = catalogueStoragePathFromUrl(item.sourceUrl);
  if (!storagePath) return item;
  if (!opts?.force && !needsEnrichment(item, opts?.notes)) return item;

  try {
    const downloaded = await db.storage.from(STORAGE_BUCKET).download(storagePath);
    if (downloaded.error || !downloaded.data) return item;
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const text = await pdfTextFromBytesHeadTail(bytes, { headPages: 28, tailPages: 30 });
    const sections = await resolvePdfSections(text);
    if (
      !sections.problemStatement &&
      !sections.objectives &&
      !sections.specificObjectives &&
      !sections.limitations &&
      !sections.references
    ) {
      // Mark attempted so page/import does not retry forever on hard PDFs.
      if (/^[0-9a-f-]{36}$/i.test(item.id)) {
        await db
          .from("title_proposals")
          .update({
            notes: "## Enriched from PDF\n\n## Recommendations\nNo recommendations section could be read from this PDF.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }
      return {
        ...item,
        limitations: item.limitations ?? "No recommendations section could be read from this PDF.",
      };
    }

    const notes = mergeSectionsIntoNotes(opts?.notes, sections);
    const next: ReviewItem = {
      ...item,
      problemStatement: sections.problemStatement ?? item.problemStatement,
      objectives: sections.objectives ?? item.objectives,
      specificObjectives: sections.specificObjectives ?? item.specificObjectives,
      limitations: sections.limitations ?? item.limitations,
      references: sections.references ?? item.references,
      summary: sections.problemStatement ?? item.summary,
      literatureNote: null,
    };

    if (/^[0-9a-f-]{36}$/i.test(item.id)) {
      const patch: Record<string, unknown> = {
        notes,
        communication: null,
        updated_at: new Date().toISOString(),
      };
      if (sections.problemStatement) {
        patch.summary = sections.problemStatement.slice(0, 1600);
      }
      await db.from("title_proposals").update(patch).eq("id", item.id);
    }

    return next;
  } catch {
    return item;
  }
}
