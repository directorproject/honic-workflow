/**
 * Re-polish already-enriched title notes (strip figure captions / page junk).
 *   node --env-file=.env.local scripts/polish-enriched-briefs.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const FIGURE_CAPTION =
  /^(?:figure|fig\.?|table|plate|chart|graph|equation|eq\.?)\s*[\d.]+(?:\s*[:.)\-–—].*)?$/i;
const LIST_ITEM = /^\s*(?:[\(\[]?[ivx0-9]+[\)\].:]|[•\-–—*]|\([a-z]\))\s+/i;

function isArtifactLine(line) {
  const t = line.trim();
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true;
  if (/^\[\d{1,3}\]$/.test(t)) return true;
  if (FIGURE_CAPTION.test(t)) return true;
  if (/^(?:figure|fig\.?|table)\s*[\d.]+\b/i.test(t) && t.length < 160) return true;
  if (/^source\s*:/i.test(t)) return true;
  return false;
}

function joinSoftWrappedLines(lines) {
  const out = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || isArtifactLine(line)) continue;
    const prev = out[out.length - 1];
    if (
      prev &&
      !LIST_ITEM.test(prev) &&
      !LIST_ITEM.test(line) &&
      !/[.!?…:]$/.test(prev) &&
      line[0] === line[0]?.toLowerCase()
    ) {
      out[out.length - 1] = `${prev} ${line}`;
      continue;
    }
    if (/^(?:of water in fuel|on the engine|in fuel combustion|cylinder)\b/i.test(line)) continue;
    out.push(line);
  }
  return out.join("\n");
}

function formatSpecific(text) {
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !isArtifactLine(l));
  const body = lines.filter(
    (l) => !/^(?:below are|the following are|specific objectives?\s*[:.]?\s*$)/i.test(l),
  );
  const items = [];
  for (const line of body) {
    if (LIST_ITEM.test(line)) {
      items.push(line.replace(LIST_ITEM, "").trim());
      continue;
    }
    if (items.length && !/[.!?]$/.test(items[items.length - 1]) && line[0] === line[0]?.toLowerCase()) {
      items[items.length - 1] = `${items[items.length - 1]} ${line}`;
      continue;
    }
    items.push(line);
  }
  const cleaned = items
    .map((item) => item.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim())
    .filter((item) => item.length >= 8);
  if (cleaned.length >= 2) {
    return cleaned.map((item, i) => `${i + 1}. ${item.replace(/^[a-z]/, (c) => c.toUpperCase())}`).join("\n");
  }
  return joinSoftWrappedLines(body);
}

function polish(text, kind) {
  if (typeof text !== "string") return null;
  let raw = text.replace(/\u0000/g, "").replace(/\r/g, "\n").trim();
  if (!raw) return null;
  raw = raw.replace(/(?:^|\n)\s*(?:Figure|Fig\.?|Table)\s*[\d.]+\s*[:.)\-–—][^\n]*/gi, "\n");
  raw = raw.replace(/(?:^|\n)\s*\[\d{1,3}\]\s*(?=\n|$)/g, "\n");
  raw = raw.replace(/(?:^|\n)\s*\d{1,3}\s*(?=\n|$)/g, "\n");

  let polished = kind === "specific" ? formatSpecific(raw) : joinSoftWrappedLines(raw.split("\n"));
  polished = polished
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (kind === "problem" || kind === "main" || kind === "recommendations") {
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

function section(raw, heading) {
  const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  return raw.match(re)?.[1]?.trim() || null;
}

function truncateBeforeBibliography(text) {
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

function rewriteNotes(notes) {
  const raw = String(notes || "");
  if (!/##\s*Enriched from PDF\b/i.test(raw)) return null;
  const problem = polish(section(raw, "Problem statement"), "problem");
  const main = polish(section(raw, "Main objective"), "main");
  const specific = polish(section(raw, "Specific objectives"), "specific");
  const recs = polish(
    truncateBeforeBibliography(
      section(raw, "Recommendations") ||
        section(raw, "Project limitations") ||
        section(raw, "Limitations") ||
        "",
    ),
    "recommendations",
  );
  // Never drop bibliography when polishing other sections.
  const refs = section(raw, "References");
  const parts = ["## Enriched from PDF"];
  if (problem) parts.push(`## Problem statement\n${problem}`);
  if (main) parts.push(`## Main objective\n${main}`);
  if (specific) parts.push(`## Specific objectives\n${specific}`);
  if (recs) parts.push(`## Recommendations\n${recs}`);
  if (refs) parts.push(`## References\n${refs}`);
  return parts.join("\n\n");
}

const { data, error } = await db
  .from("title_proposals")
  .select("id, title, notes, summary")
  .neq("status", "dropped")
  .ilike("notes", "%Enriched from PDF%");

if (error) {
  console.error(error.message);
  process.exit(1);
}

let ok = 0;
for (const row of data || []) {
  const next = rewriteNotes(row.notes);
  if (!next || next === row.notes) continue;
  const patch = { notes: next, updated_at: new Date().toISOString() };
  const problem = polish(section(next, "Problem statement"), "problem");
  if (problem) patch.summary = problem.slice(0, 1600);
  const { error: upErr } = await db.from("title_proposals").update(patch).eq("id", row.id);
  if (upErr) {
    console.log("FAIL", row.title, upErr.message);
    continue;
  }
  ok += 1;
  console.log("OK", String(row.title || row.id).slice(0, 70));
}
console.log(`Polished ${ok}/${(data || []).length}`);
