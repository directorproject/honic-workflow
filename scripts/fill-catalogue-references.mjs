/**
 * Fill ## References (max 5) from catalogue PDF REFERENCES chapters.
 * Merges into existing enriched notes without wiping other sections.
 *
 *   node --env-file=.env.local scripts/fill-catalogue-references.mjs
 *   node --env-file=.env.local scripts/fill-catalogue-references.mjs --limit=10
 */
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;
const MAX_REFS = 5;

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

async function pdfTailText(bytes, tailPages = 35) {
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

const FIGURE_CAPTION =
  /^(?:figure|fig\.?|table|plate|chart|graph|equation|eq\.?)\s*[\d.]+(?:\s*[:.)\-–—].*)?$/i;
const LIST_ITEM = /^\s*(?:[\(\[]?[ivx0-9]+[\)\].:]|[•\-–—*]|\([a-z]\))\s+/i;

function isArtifactLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true;
  if (/^\[\d{1,3}\]$/.test(t)) return true;
  if (FIGURE_CAPTION.test(t)) return true;
  return false;
}

function polishReferences(rawIn) {
  let raw = String(rawIn || "").replace(/\u0000/g, "").replace(/\r/g, "\n").trim();
  if (!raw) return null;
  raw = raw.replace(/(?:^|\n)\s*(?:Figure|Fig\.?|Table)\s*[\d.]+\s*[:.)\-–—][^\n]*/gi, "\n");
  raw = raw.replace(/(?:^|\n)\s*\d{1,3}\s*(?=\n|$)/g, "\n");

  const chunks = [];
  if (/\[\d+\]/.test(raw)) {
    for (const part of raw.split(/(?=\[\d+\])/)) {
      const t = part.replace(/\s+/g, " ").replace(/^\[\d+\]\s*/, "").trim();
      if (t.length >= 18) chunks.push(t);
    }
  } else {
    const stripEntryMarker = (line) => {
      if (/^\d+\s*[.)]\s+\S/.test(line)) return line.replace(/^\d+\s*[.)]\s*/, "").trim();
      if (LIST_ITEM.test(line)) return line.replace(LIST_ITEM, "").trim();
      return line.trim();
    };
    const lines = raw
      .split(/\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
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

  const unique = [];
  for (const c of chunks) {
    const cleaned = c.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim().slice(0, 500);
    if (cleaned.length < 18) continue;
    if (unique.some((u) => u.slice(0, 48).toLowerCase() === cleaned.slice(0, 48).toLowerCase())) continue;
    unique.push(cleaned);
    if (unique.length >= MAX_REFS) break;
  }
  if (!unique.length) return null;
  return unique.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

function extractReferences(rawText) {
  const text = String(rawText || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    // Spaced PDF titles: "R E F E R E N C E S"
    .replace(/\b((?:[A-Za-z] ){4,}[A-Za-z])\b/g, (m) => m.replace(/ /g, ""));
  const heading =
    /(?:^|\n)\s*(?:(?:chapter|ch\.?)\s+)?(?:\d+(?:\.\d+)*\.?\s+)?(?:REFERENCES|BIBLIOGRAPHY|LIST OF REFERENCES|WORKS\s+CITED|LITERATURE\s+CITED)\b\s*(?=\n|:|\[)/gi;
  let lastEnd = -1;
  let match;
  while ((match = heading.exec(text))) lastEnd = match.index + match[0].length;
  if (lastEnd < 0) {
    // Fallback: last dense [1]…[n] block near the end of the document.
    const bracket = [...text.matchAll(/\[\d+\]\s+\S[\s\S]{20,800}?(?=\n\s*\[\d+\]|\n\s*(?:\d+(?:\.\d+)*\.?\s+)?(?:APPENDIX|APPENDICES|ANNEX)\b|$)/gi)];
    if (bracket.length >= 2) {
      const start = bracket[0].index ?? -1;
      if (start >= 0) return polishReferences(text.slice(start, start + 12000));
    }
    return null;
  }
  let body = text.slice(lastEnd);
  const stop = body.search(/\n\s*(?:\d+(?:\.\d+)*\.?\s+)?(?:APPENDIX|APPENDICES|ANNEX|GLOSSARY)\b/i);
  if (stop > 40) body = body.slice(0, stop);
  return polishReferences(body.slice(0, 12000));
}

function upsertReferencesNotes(notes, refs) {
  const raw = String(notes || "").trim();
  if (!refs) return raw || null;
  if (/##\s*References\b/i.test(raw)) {
    return raw.replace(/##\s*References\s*\n[\s\S]*?(?=\n##\s|$)/i, `## References\n${refs}\n`).trim();
  }
  if (/##\s*Enriched from PDF\b/i.test(raw)) {
    return `${raw.replace(/\s*$/, "")}\n\n## References\n${refs}`;
  }
  // Keep any existing brief sections; only append references.
  return `${raw || "## Enriched from PDF"}\n\n## References\n${refs}`.trim();
}

const { data: rows, error } = await db
  .from("title_proposals")
  .select("id, title, notes, origin_ref, status")
  .neq("status", "dropped")
  .not("origin_ref", "is", null)
  .order("created_at", { ascending: true });

if (error) {
  console.error(error.message);
  process.exit(1);
}

const candidates = (rows ?? []).filter((r) => cataloguePathFromOrigin(r.origin_ref));
const work = limit > 0 ? candidates.slice(0, limit) : candidates;
console.log(`Fill references (max ${MAX_REFS}) for ${work.length} titles`);

let ok = 0;
let found = 0;
let fail = 0;

for (const row of work) {
  const storagePath = cataloguePathFromOrigin(row.origin_ref);
  const label = String(row.title ?? row.id).slice(0, 70);
  try {
    const downloaded = await db.storage.from(BUCKET).download(storagePath);
    if (downloaded.error || !downloaded.data) {
      fail += 1;
      console.log(`FAIL download ${label}`);
      continue;
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const text = await pdfTailText(bytes, 45);
    const refs = extractReferences(text);
    const notes = upsertReferencesNotes(row.notes, refs);
    const { error: upErr } = await db
      .from("title_proposals")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (upErr) {
      fail += 1;
      console.log(`FAIL update ${label}: ${upErr.message}`);
      continue;
    }
    ok += 1;
    if (refs) found += 1;
    const n = refs ? refs.split("\n").length : 0;
    console.log(`OK ${ok}/${work.length} ${label} · refs=${n}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL ${label}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`Done. ok=${ok} with_refs=${found} fail=${fail}`);
