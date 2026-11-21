/**
 * OD NTA L6 Mini One / “DIT NTA L6 ETE & CST …” list is NOT imported into the
 * live catalogue (those rows are soft-dropped). Kept only as a local parser
 * reference if staff re-import under a different batch later.
 *
 *   node scripts/import-dit-title-lists.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase admin env");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const FILES = [
  // Intentionally empty: do not re-import the OD Mini One PDF into production.
];

const INSTITUTION = "Dar es Salaam Institute of Technology (DIT)";

function clean(s, max = 300) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/[|\[\]]/g, " ")
    .trim()
    .slice(0, max);
}

function titleCase(s) {
  const t = clean(s, 280);
  if (!t) return "";
  // Keep all-caps short acronyms; otherwise sentence-ish title case for readability
  if (t === t.toUpperCase() && t.length > 12) {
    return t
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\b(And|Or|Of|For|The|In|On|With|To|A|An)\b/g, (m) => m.toLowerCase())
      .replace(/^[a-z]/, (m) => m.toUpperCase());
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function okTitle(t) {
  if (!t) return false;
  const s = t.toLowerCase();
  if (s.length < 12 || s.length > 280) return false;
  if (/^(dr|ms|mr|mrs|prof)\b/.test(s)) return false;
  if (/adm\.?\s*no|name|title|comments|column|w15-|s\.?no|reg\.?no|academic year|dar es salaam|electronics and/i.test(s))
    return false;
  if (!/[a-z]/i.test(t) || !/\s/.test(t)) return false;
  return true;
}

function seed(title, source) {
  return `dit-${source}-${crypto.createHash("sha1").update(title.toLowerCase()).digest("hex").slice(0, 14)}`;
}

async function pdfText(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const parts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it) => it.str).join(" "));
  }
  return parts.join("\n");
}

/** ETE CST list: … Title … Approved|Not Approved|Pending … */
function parseApprovedList(text) {
  const out = [];
  const re =
    /(\d{1,3})\s+(?:[A-Z0-9-]{6,}\s+)?([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.']*){0,4})\s+(.+?)\s+(Approved|Not Approved|Pending Approval(?:\([^)]*\))?)/gis;
  let m;
  while ((m = re.exec(text))) {
    const status = m[4];
    if (/not approved/i.test(status)) continue;
    const title = titleCase(m[3]);
    if (!okTitle(title)) continue;
    out.push({ title, comment: status.replace(/\s+/g, " ").trim() });
  }
  return out;
}

/** OD mini list: S.No Name Reg Title — titles often ALL CAPS after reg numbers */
function parseOdList(text) {
  const out = [];
  // Split on leading serial numbers that start a row
  const chunks = text.split(/(?=\b\d{1,2}\s+[A-Z])/);
  for (const chunk of chunks) {
    const m = chunk.match(
      /^\s*(\d{1,2})\s+([A-Z][A-Z,'\s.-]{2,60}?)\s+(\d{9,14})\s+(.+?)(?=\s+\d{1,2}\s+[A-Z]|\s*$)/is,
    );
    if (!m) {
      // Fallback: number + name fragments + reg + title to end
      const m2 = chunk.match(/^\s*(\d{1,2})\b[\s\S]{0,80}?(\d{9,14})\s+(.+)$/is);
      if (!m2) continue;
      const title = titleCase(m2[3]);
      if (okTitle(title)) out.push({ title, comment: "OD final year project" });
      continue;
    }
    const title = titleCase(m[4]);
    if (okTitle(title)) out.push({ title, comment: "OD final year project" });
  }
  return out;
}

function buildRow({ title, sourceKey, batch, course, domain, comment, originLabel }) {
  const t = clean(title, 280);
  const key = seed(t, sourceKey);
  const summary = clean(
    `DIT ${domain}: ${t}. Use this as a starting title — write a local problem statement, objectives, and prototype plan for your course.`,
    1800,
  );
  const notes = [
    "## Main objective",
    `Design, implement, and evaluate a working solution for: ${t}.`,
    "",
    "## Specific objectives",
    "1. Survey related work and prior student projects on this theme.",
    "2. Write a clear problem statement and requirements for your campus or community context.",
    "3. Design and build a prototype, then test it against the requirements.",
    "4. Document results, limits, and recommendations.",
    "",
    "## Literature and source",
    `Source list: ${originLabel}`,
    comment ? `List note: ${comment}` : null,
    "This entry is from a department title list (not a full report PDF).",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    seed_key: key,
    batch,
    origin_ref: originLabel,
    original_title: t,
    title: t,
    summary,
    hardware: null,
    communication: domain,
    status: "available",
    institution: INSTITUTION,
    course_code: course,
    notes,
    updated_at: new Date().toISOString(),
  };
}

if (!FILES.length) {
  console.log("No OD/Approved PDFs configured for import (batch removed from catalogue).");
  process.exit(0);
}

const byKey = new Map();
let parsedTotal = 0;

for (const file of FILES) {
  if (!fs.existsSync(file.path)) {
    console.error("Missing PDF:", file.path);
    process.exit(1);
  }
  const text = await pdfText(file.path);
  const items = file.kind === "approved" ? parseApprovedList(text) : parseOdList(text);
  console.log(`${path.basename(file.path)} → ${items.length} titles`);
  parsedTotal += items.length;
  for (const item of items) {
    const row = buildRow({
      title: item.title,
      sourceKey: file.sourceKey,
      batch: file.batch,
      course: file.course,
      domain: file.domain,
      comment: item.comment,
      originLabel: path.basename(file.path),
    });
    byKey.set(row.seed_key, row);
  }
}

const rows = [...byKey.values()];
console.log(`Unique titles to upsert: ${rows.length} (parsed ${parsedTotal})`);

let ok = 0;
let fail = 0;
for (const row of rows) {
  const { error } = await db.from("title_proposals").upsert(row, { onConflict: "seed_key" });
  if (error) {
    fail += 1;
    console.error("FAIL", row.title, error.message);
  } else {
    ok += 1;
    if (ok <= 8 || ok % 25 === 0) console.log(`OK ${ok}/${rows.length} · ${row.title}`);
  }
}

console.log(`Done. Imported/updated ${ok}, failed ${fail}.`);
