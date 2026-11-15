/**
 * Re-parse BENG 19 ETE PDF titles; fix glued suffixes; drop person-name rows.
 *
 *   node scripts/fix-beng19-titles.mjs [path/to/pdf-folder]
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

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pdfDir = path.resolve(
  process.argv[2] || path.join(projectRoot, "..", "..", "_beng19_extract", "BENG 19 ETE reports"),
);
const pdfjsPath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
const pdfjs = await import(pathToFileURL(pdfjsPath).href);

function clean(s, max = 300) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function scrubTitle(raw) {
  let t = clean(raw, 260);
  t = t
    .replace(/\s+PROJECT\s+TY\s*PE\b.*$/i, "")
    .replace(/\s+PROJECT\s+TYPE\b.*$/i, "")
    .replace(/\s+CANDIDATE.*$/i, "")
    .replace(/\s+STUDENT[’']?S?\b.*$/i, "")
    .replace(/\s+NAME\s*[:\-–].*$/i, "")
    .replace(/\s+REG\s*NO\b.*$/i, "")
    .replace(/\s+SUPERVISOR\b.*$/i, "")
    .replace(/\bPROJ\s*ECT\b/gi, "PROJECT")
    .replace(/\bINTELLIG\s*E\s*NT\b/gi, "INTELLIGENT")
    .replace(/\bCONSU\s*M\s*PTION\b/gi, "CONSUMPTION")
    .replace(/\bPRERE\s*QUISITE\b/gi, "PREREQUISITE")
    .replace(/\bAUTO\s*MATIC\b/gi, "AUTOMATIC")
    .replace(/\bD\s*R\s*ONE\b/gi, "DRONE")
    .replace(/\bA\s*R\s*EPORT\b/gi, "REPORT")
    .replace(/\bFOREST\s*RY\b/gi, "FORESTRY")
    .replace(/\bLLOGGING\b/gi, "LOGGING")
    .replace(/\bSYSTE\s*M\b/gi, "SYSTEM")
    .replace(/\bFACTOR\s*S\b/gi, "FACTOR")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*[.]+$/, "")
    .trim();
  return t;
}

function isPersonName(t) {
  const words = t.split(/\s+/).filter(Boolean);
  const projectHint =
    /\b(system|iot|smart|design|detection|robot|automatic|monitor|automation|sensor|control|wireless|machine|device|app|network|alert|tracking|payment|irrigation|security|solar|traffic|recognition|vending|sorting|measurement|navigation|gps|gsm|ai|based|using)\b/i.test(
      t,
    );
  if (projectHint) return false;
  if (words.length <= 4 && words.every((w) => /^[A-Za-z][A-Za-z.'’-]*$/.test(w))) return true;
  return false;
}

function looksLikeTitle(t) {
  if (!t || t.length < 12 || t.length > 220) return false;
  if (isPersonName(t)) return false;
  if (/declaration|certification|department of|bachelor of|nta level/i.test(t)) return false;
  return /\b(system|iot|smart|design|automatic|monitor|device|machine|detection|control|using|based|alert|tracking|payment|security|solar|traffic|network|app|vending|sorting|irrigation|navigation|gps|gsm|ai)\b/i.test(
    t,
  );
}

async function extractText(filePath, maxPages = 3) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= Math.min(maxPages, doc.numPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n\n";
  }
  return text;
}

function parseTitle(text) {
  const patterns = [
    /PROJECT\s+TITLE\s*[:\-–]\s*([\s\S]{8,220}?)(?=\s+PROJECT\s+TY|\s+PROJECT\s+TYPE|\s+NAME\s*[:\-–]|\s+CANDIDATE|\s+REG\s*NO|\s+STUDENT|\s+ACADEMIC\s+YEAR|\s+SUPERVISOR)/i,
    /PROJECT\s+TITLE\s+([\s\S]{8,220}?)(?=\s+PROJECT\s+TY|\s+PROJECT\s+TYPE|\s+NAME\s*[:\-–]|\s+CANDIDATE|\s+REG\s*NO|\s+STUDENT)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const t = scrubTitle(m[1]);
      if (looksLikeTitle(t)) return t;
    }
  }
  // Line-ish fallback: longest uppercase-ish phrase with project words near the top
  const chunk = text.slice(0, 1800);
  const candidates = chunk
    .split(/\n+|(?<=\.)\s+/)
    .map((s) => scrubTitle(s))
    .filter((s) => looksLikeTitle(s));
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? null;
}

function seedFor(fileName, title) {
  const base = crypto.createHash("sha1").update(`${fileName}|${title.toLowerCase()}`).digest("hex").slice(0, 16);
  return `beng19-ete-${base}`;
}

const { data: rows, error } = await db
  .from("title_proposals")
  .select("id, title, seed_key, origin_ref, summary, notes")
  .like("seed_key", "beng19-ete-%")
  .neq("status", "dropped");
if (error) throw new Error(error.message);

const files = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith(".pdf"));
const bySeedFile = new Map();
// Map storage seed from filename by recomputing old seed with old title is hard;
// instead match via origin_ref path ending .pdf and re-read every file against current seeds by re-upload key.

let fixed = 0;
let dropped = 0;
const used = new Set();

for (const file of files) {
  const full = path.join(pdfDir, file);
  let text;
  try {
    text = await extractText(full, 4);
  } catch (err) {
    console.error("read fail", file, err.message);
    continue;
  }
  const title = parseTitle(text);
  if (!title) {
    console.log("NO_TITLE", file);
    continue;
  }

  // Find matching DB row: origin path uses seed from original import (file+old title).
  // Prefer match by scanning rows whose origin contains seed hash from any prior title for this file.
  // Practical approach: recompute possible seeds is unknown; match by checking storage file list
  // OR update by finding row where notes mention file... We stored seed from file+title at import.
  // Recompute seed with NEW title changes seed_key — better update in place by matching file via
  // listing seeds from storage or by fuzzy: for each file, try seed with cleaned current titles.

  // Find row by trying seed(file, existingTitle) for each row — expensive but n=95.
  let row = null;
  for (const r of rows ?? []) {
    if (used.has(r.id)) continue;
    const maybe = seedFor(file, r.title);
    if (maybe === r.seed_key) {
      row = r;
      break;
    }
  }
  if (!row) {
    // Fallback: seed from any scrub of current title variants already failed; try all files' seeds against path
    for (const r of rows ?? []) {
      if (used.has(r.id)) continue;
      if (String(r.origin_ref ?? "").includes(r.seed_key) && !used.has(r.id)) {
        // leave for later pass
      }
    }
  }

  // Stronger fallback: match by storage object listing — upload path catalogue/beng19-ete/{seed}.pdf
  // We'll match row.seed_key present in origin_ref and not yet used; assign in file order if titles were person names.
  if (!row) {
    // Match remaining unused rows where current title is person-like or contains PROJECT TYPE, prefer those for this file order
    row =
      (rows ?? []).find((r) => !used.has(r.id) && (isPersonName(r.title) || /PROJECT\s+TYPE/i.test(r.title))) ??
      null;
  }

  // Last resort: match unused row by seed in origin for file content hash of storage
  if (!row) {
    const guessSeed = seedFor(file, title);
    row = (rows ?? []).find((r) => !used.has(r.id) && r.seed_key === guessSeed) ?? null;
  }

  if (!row) {
    // Create/update via upsert with new seed from corrected title; also keep old storage if we can copy
    const seed = seedFor(file, title);
    const publicOrigin = (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "https://share.honiccompany.com").replace(
      /\/$/,
      "",
    );
    const storagePath = `catalogue/beng19-ete/${seed}.pdf`;
    const docUrl = `${publicOrigin}/api/portal/catalogue-docs/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
    const bytes = fs.readFileSync(full);
    await db.storage.from("portal-files").upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
    await db.from("title_proposals").upsert(
      {
        seed_key: seed,
        batch: "BENG 19 ETE",
        origin_ref: docUrl,
        original_title: title,
        title,
        summary: `BEng ETE project report (DIT): ${title}. Open the attached PDF for the full explanation, objectives, and design.`,
        communication: "Electronics and Telecommunications Engineering",
        status: "available",
        institution: "Dar es Salaam Institute of Technology (DIT)",
        course_code: "ETE",
        notes: `## Literature and source\nSource report (PDF): ${docUrl}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "seed_key" },
    );
    fixed += 1;
    console.log("UPSERT", title);
    continue;
  }

  used.add(row.id);
  const seed = row.seed_key;
  const publicOrigin = (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "https://share.honiccompany.com").replace(
    /\/$/,
    "",
  );
  const storagePath = `catalogue/beng19-ete/${seed}.pdf`;
  const docUrl = `${publicOrigin}/api/portal/catalogue-docs/${storagePath.split("/").map(encodeURIComponent).join("/")}`;

  const { error: upErr } = await db
    .from("title_proposals")
    .update({
      title,
      original_title: title,
      origin_ref: docUrl,
      summary: String(row.summary ?? "").replace(row.title, title).slice(0, 1800),
      notes: String(row.notes ?? "").replaceAll(row.title, title),
      status: "available",
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (upErr) console.error(upErr.message);
  else {
    fixed += 1;
    console.log("FIX", row.title, "=>", title);
  }
}

// Drop remaining person-name / garbage BENG titles
const { data: still } = await db
  .from("title_proposals")
  .select("id, title")
  .like("seed_key", "beng19-ete-%")
  .neq("status", "dropped");

const drop = [];
for (const r of still ?? []) {
  const t = scrubTitle(r.title);
  if (isPersonName(t) || !looksLikeTitle(t) || /PROJECT\s+TYPE/i.test(r.title)) drop.push(r.id);
}
if (drop.length) {
  await db.from("title_proposals").update({ status: "dropped", updated_at: new Date().toISOString() }).in("id", drop);
  dropped = drop.length;
}

// Global dedupe again
const { data: active } = await db.from("title_proposals").select("id, title, seed_key, origin_ref").neq("status", "dropped");
const best = new Map();
const dup = [];
for (const row of active ?? []) {
  const key = String(row.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!key) continue;
  const prev = best.get(key);
  if (!prev) {
    best.set(key, row);
    continue;
  }
  const prefer =
    String(row.seed_key ?? "").startsWith("beng19-") || /catalogue-docs|github\.com/i.test(String(row.origin_ref ?? ""));
  if (prefer && !String(prev.seed_key ?? "").startsWith("beng19-")) {
    dup.push(prev.id);
    best.set(key, row);
  } else dup.push(row.id);
}
if (dup.length) {
  await db.from("title_proposals").update({ status: "dropped", updated_at: new Date().toISOString() }).in("id", dup);
}

const { count: left } = await db.from("title_proposals").select("id", { count: "exact", head: true }).neq("status", "dropped");
const { count: beng } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .like("seed_key", "beng19-ete-%")
  .neq("status", "dropped");

console.log("DONE", { fixed, droppedPersonOrBad: dropped, dedupe: dup.length, beng_active: beng, all_active: left });
