/**
 * Import BENG 19 ETE project report PDFs into title_proposals + portal-files storage.
 *
 *   node scripts/import-beng19-ete-reports.mjs [path/to/pdf-folder]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();

for (const file of [".env.local", ".env"]) {
  const envPath = path.join(projectRoot, file);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicOrigin = (
  process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://share.honiccompany.com"
).replace(/\/$/, "");

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const pdfDir = path.resolve(
  process.argv[2] ||
    path.join(projectRoot, "..", "..", "_beng19_extract", "BENG 19 ETE reports"),
);
if (!fs.existsSync(pdfDir)) {
  console.error(`PDF folder not found: ${pdfDir}`);
  process.exit(1);
}

const pdfjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
const pdfjs = await import(pathToFileURL(pdfjsPath).href);

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const BUCKET = "portal-files";

function clean(s, max = 300) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function seedFor(fileName, title) {
  const base = crypto.createHash("sha1").update(`${fileName}|${title.toLowerCase()}`).digest("hex").slice(0, 16);
  return `beng19-ete-${base}`;
}

async function extractText(filePath, maxPages = 4) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let text = "";
  const n = Math.min(maxPages, doc.numPages);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n\n";
  }
  return text;
}

function parseTitle(text, fileName) {
  const patterns = [
    /PROJECT\s+TITLE\s*[:\-–]\s*(.+?)(?=\s+PROJECT\s+TYPE|\s+NAME\s*[:\-–]|\s+REG\s*NO|\s+ACADEMIC\s+YEAR|\s+SUPERVISOR|$)/is,
    /PROJECT\s+TITLE\s+(.+?)(?=\s+PROJECT\s+TYPE|\s+NAME\s*[:\-–]|\s+REG\s*NO|$)/is,
    /Title\s*[:\-–]\s*(.+?)(?=\s+Name\s*[:\-–]|\s+Reg|\s+Supervisor|$)/is,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      let t = clean(m[1], 220);
      t = t.replace(/\s+/g, " ").replace(/\s*[:\-–]\s*$/, "").trim();
      if (t.length >= 12 && !/declaration|certification|department of/i.test(t)) return t;
    }
  }
  // Fallback: filename without reg number
  const base = path.basename(fileName, path.extname(fileName));
  const withoutReg = base.replace(/[\s_\-.,;()]*\d{9,}.*$/g, "").replace(/[_]+/g, " ").trim();
  return clean(withoutReg || base, 220);
}

function parseAbstract(text) {
  const m = text.match(/ABSTRACT\s+([\s\S]{80,1800}?)(?=\s+(?:CHAPTER\s*1|TABLE\s+OF\s+CONTENTS|ACKNOWLEDG|LIST\s+OF|CHAPTER\s+ONE|1\.\s*INTRODUCTION))/i);
  if (m?.[1]) return clean(m[1], 1600);
  const m2 = text.match(/ABSTRACT\s+([\s\S]{80,1200})/i);
  if (m2?.[1]) return clean(m2[1].split(/\n\n/)[0], 1600);
  return null;
}

function parseYear(text) {
  const m = text.match(/ACADEMIC\s+YEAR\s*[:\-–]?\s*(\d{4}\s*\/\s*\d{4}|\d{4})/i);
  if (m?.[1]) return clean(m[1].replace(/\s+/g, ""), 20);
  const m2 = text.match(/\b(20\d{2})\s*$/m);
  return m2?.[1] ?? "2022/2023";
}

function buildNotesFromPdfText(text, { title, abstract }) {
  // Prefer heading extraction; fall back to abstract only for problem.
  const PROBLEM =
    /(?:statement\s+of\s+the\s+problem|problem\s+statement|(?:1\.\s*2|1\.2)\s+problem(?:\s+statement)?)\b/i;
  const SPECIFIC =
    /(?:specific\s+objectives?|(?:1\.\s*3\.\s*2|1\.3\.2)\s+specific\s+objectives?)\b/i;
  const LIMIT =
    /(?:limitations?\s+of\s+(?:the\s+)?(?:study|project|research)|project\s+limitations?|project\s+weakness(?:es)?|delimitations?)\b/i;
  const NEXT =
    /\n\s*(?:\d+(?:\.\d+){1,3}\.?\s+)(?:[A-Z][A-Za-z].{0,90}|problem|objective|limitation|weakness|organization|chapter)/i;

  function slice(bodyStart) {
    const rest = text.slice(bodyStart);
    const next = rest.search(NEXT);
    const end = next > 12 ? next : Math.min(rest.length, 2200);
    return clean(rest.slice(0, end), 3500);
  }
  function byHeading(re) {
    const m = new RegExp(`(?:^|\\n)\\s*(?:\\d+(?:\\.\\d+)*\\.?\\s+)?${re.source}\\s*(?:\\n|:|\\-|–)?`, "i").exec(text);
    if (!m) return null;
    const body = slice(m.index + m[0].length);
    return body.length >= 20 ? body : null;
  }

  const problem = byHeading(PROBLEM) || abstract || null;
  let specific = byHeading(SPECIFIC);
  let main =
    byHeading(/(?:general\s+objectives?|main\s+objectives?|overall\s+objectives?)\b/i) ||
    byHeading(/aim\s+of\s+(?:the\s+)?(?:study|project)\b/i);
  if (!main) {
    const block = byHeading(/(?:1\.\s*3|1\.3)\s+objectives?\b/i);
    if (block) {
      const at = block.search(/\n\s*specific\s+objectives?\b/i);
      if (at > 20) {
        main = clean(block.slice(0, at), 2000);
        if (!specific) specific = clean(block.slice(at).replace(/^[^\n]*\n/, ""), 3000);
      } else {
        main = clean(block, 2000);
      }
    }
  }
  const limits = byHeading(LIMIT);

  const parts = ["## Enriched from PDF"];
  if (problem) parts.push(`## Problem statement\n${problem}`);
  else parts.push(`## Problem statement\nReview the attached BEng ETE report for “${title}”.`);
  if (main) parts.push(`## Main objective\n${main}`);
  if (specific) parts.push(`## Specific objectives\n${specific}`);
  if (limits) parts.push(`## Project limitations\n${limits}`);
  return parts.join("\n\n");
}

const files = fs
  .readdirSync(pdfDir)
  .filter((f) => f.toLowerCase().endsWith(".pdf"))
  .sort((a, b) => a.localeCompare(b));

console.log(`Found ${files.length} PDFs in ${pdfDir}`);

const seenTitles = new Set();
let imported = 0;
let skipped = 0;
const failures = [];

for (const file of files) {
  const full = path.join(pdfDir, file);
  try {
    const text = await extractText(full, 16);
    const title = parseTitle(text, file);
    if (!title || title.length < 12) {
      skipped += 1;
      failures.push({ file, reason: "no_title" });
      continue;
    }
    const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenTitles.has(norm)) {
      skipped += 1;
      failures.push({ file, reason: "duplicate_title", title });
      continue;
    }
    seenTitles.add(norm);

    const abstract = parseAbstract(text);
    const year = parseYear(text);
    const seed = seedFor(file, title);
    const storagePath = `catalogue/beng19-ete/${seed}.pdf`;
    const docUrl = `${publicOrigin}/api/portal/catalogue-docs/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
    const bytes = fs.readFileSync(full);

    const { error: upErr } = await db.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw new Error(`upload: ${upErr.message}`);

    const notes = buildNotesFromPdfText(text, { title, abstract });
    const problemMatch = notes.match(/##\s*Problem statement\s*\n([\s\S]*?)(?=\n##\s|$)/i);
    const summary = clean(problemMatch?.[1] || abstract || title, 1800);

    const row = {
      seed_key: seed,
      batch: `BENG 19 ETE ${year}`,
      origin_ref: docUrl,
      original_title: title,
      title,
      summary,
      hardware: null,
      communication: null,
      status: "available",
      institution: "Dar es Salaam Institute of Technology (DIT)",
      course_code: "ETE",
      notes,
      updated_at: new Date().toISOString(),
    };

    const { error: upDb } = await db.from("title_proposals").upsert(row, { onConflict: "seed_key" });
    if (upDb) throw new Error(`db: ${upDb.message}`);

    imported += 1;
    console.log(`OK ${imported}/${files.length} · ${title}`);
  } catch (err) {
    skipped += 1;
    failures.push({ file, reason: err?.message ?? String(err) });
    console.error(`FAIL ${file}:`, err?.message ?? err);
  }
}

// Drop any remaining active duplicates against new BENG titles by normalized title.
const { data: active } = await db
  .from("title_proposals")
  .select("id, title, seed_key, origin_ref, summary")
  .neq("status", "dropped");

const best = new Map();
const dropDup = [];
for (const row of active ?? []) {
  const key = String(row.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!key) continue;
  const prev = best.get(key);
  const preferNew =
    !prev ||
    String(row.seed_key ?? "").startsWith("beng19-") ||
    (/catalogue-docs|github\.com/i.test(String(row.origin_ref ?? "")) &&
      !String(prev.seed_key ?? "").startsWith("beng19-"));
  if (!prev) best.set(key, row);
  else if (preferNew && prev !== row) {
    dropDup.push(prev.id);
    best.set(key, row);
  } else if (prev.id !== row.id) {
    dropDup.push(row.id);
  }
}

if (dropDup.length) {
  const now = new Date().toISOString();
  for (let i = 0; i < dropDup.length; i += 80) {
    await db
      .from("title_proposals")
      .update({ status: "dropped", updated_at: now })
      .in("id", dropDup.slice(i, i + 80));
  }
}

const { count: left } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .neq("status", "dropped");
const { count: beng } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .like("seed_key", "beng19-ete-%")
  .neq("status", "dropped");

console.log("DONE", { imported, skipped, dedupeDropped: dropDup.length, beng_active: beng, all_active: left });
if (failures.length) console.log("FAILURES", failures.slice(0, 20));
