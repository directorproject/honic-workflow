/**
 * Strip bibliography bleed from ## Recommendations and rebuild notes;
 * then re-fill ## References (max 5) from PDF tail only.
 *
 *   node --env-file=.env.local scripts/repair-bibliography-duplicates.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);

const { truncateBeforeBibliography, polishBriefText, polishReferencesText, extractReferencesFromPdf } = await import(
  pathToFileURL(require.resolve("../src/lib/portal/pdf-sections.ts")).href,
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.PORTAL_FILES_BUCKET || "portal-files";
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

function cataloguePathFromOrigin(origin) {
  const m = String(origin ?? "").match(/\/api\/portal\/catalogue-docs\/(.+)$/i);
  if (!m?.[1]) return null;
  try {
    const path = m[1]
      .split("/")
      .map((p) => decodeURIComponent(p))
      .join("/");
    if (!path.startsWith("catalogue/") || path.includes("..") || !/\.pdf$/i.test(path)) return null;
    return path;
  } catch {
    return null;
  }
}

function textFromItems(items) {
  let out = "";
  let lastX = null;
  let lastY = null;
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

async function pdfTailText(bytes, tailPages = 45) {
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const total = doc.numPages;
  let text = "";
  for (let i = Math.max(1, total - tailPages + 1); i <= total; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += textFromItems(content.items) + "\n\n";
  }
  return text.replace(/\b((?:[A-Za-z] ){4,}[A-Za-z])\b/g, (m) => m.replace(/ /g, ""));
}

function section(raw, heading) {
  const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  return raw.match(re)?.[1]?.trim() || null;
}

function rebuildNotes(notes, refsFromPdf) {
  const raw = String(notes || "");
  if (!/##\s*Enriched from PDF\b/i.test(raw)) return null;

  const problem = polishBriefText(section(raw, "Problem statement"), "problem");
  const main = polishBriefText(section(raw, "Main objective"), "main");
  const specific = polishBriefText(section(raw, "Specific objectives"), "specific");
  const recsRaw =
    section(raw, "Recommendations") ||
    section(raw, "Project limitations") ||
    section(raw, "Limitations") ||
    section(raw, "Project weakness");
  const recs = polishBriefText(truncateBeforeBibliography(recsRaw || ""), "recommendations");

  const existingRefs = section(raw, "References");
  const refs =
    refsFromPdf ||
    (existingRefs ? polishReferencesText(truncateBeforeBibliography(existingRefs)) : null);

  const parts = ["## Enriched from PDF"];
  if (problem) parts.push(`## Problem statement\n${problem}`);
  if (main) parts.push(`## Main objective\n${main}`);
  if (specific) parts.push(`## Specific objectives\n${specific}`);
  if (recs) parts.push(`## Recommendations\n${recs}`);
  else if (recsRaw) parts.push(`## Recommendations\nNo recommendations section could be read from this PDF.`);
  if (refs) parts.push(`## References\n${refs}`);
  return parts.join("\n\n");
}

const { data: rows, error } = await db
  .from("title_proposals")
  .select("id, title, notes, origin_ref, status")
  .neq("status", "dropped")
  .not("origin_ref", "is", null)
  .ilike("notes", "%Enriched from PDF%");

if (error) {
  console.error(error.message);
  process.exit(1);
}

const work = (rows ?? []).filter((r) => cataloguePathFromOrigin(r.origin_ref));
console.log(`Repair bibliography bleed for ${work.length} enriched titles`);

let ok = 0;
let refsFound = 0;
let fail = 0;

for (const row of work) {
  const label = String(row.title ?? row.id).slice(0, 72);
  const storagePath = cataloguePathFromOrigin(row.origin_ref);
  let refsFromPdf = null;
  try {
    if (storagePath) {
      const downloaded = await db.storage.from(BUCKET).download(storagePath);
      if (downloaded.data) {
        const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
        const tail = await pdfTailText(bytes, 45);
        refsFromPdf = extractReferencesFromPdf(tail);
      }
    }
    const notes = rebuildNotes(row.notes, refsFromPdf);
    if (!notes || notes === row.notes) {
      console.log(`SKIP (unchanged) ${label}`);
      continue;
    }
    const patch = { notes, updated_at: new Date().toISOString() };
    const problem = section(notes, "Problem statement");
    if (problem) patch.summary = problem.slice(0, 1600);
    const { error: upErr } = await db.from("title_proposals").update(patch).eq("id", row.id);
    if (upErr) {
      fail += 1;
      console.log(`FAIL ${label}: ${upErr.message}`);
      continue;
    }
    ok += 1;
    if (/##\s*References\b/i.test(notes)) refsFound += 1;
    console.log(`OK ${ok}/${work.length} ${label}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL ${label}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`Done. repaired=${ok} with_refs=${refsFound} fail=${fail}`);