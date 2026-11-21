/**
 * Import DIT BENG22COE Project Realization titles from Google Sheet.
 *
 *   node scripts/import-dit-coe-sheet.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SHEET_ID = "1gd49oiJ8ED9NCbOmE63Ti1fDGETLMSo9OHtbiju-jWY";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const SOURCE_KEY = "beng22coe-2025";
const BATCH = "DIT BENG22COE Project Realization 2025/2026";
const INSTITUTION = "Dar es Salaam Institute of Technology (DIT)";
const ORIGIN = "BENG22COE-CA-COU 08204 Google Sheet";

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
  if (!/[a-z]/i.test(t) || !/\s/.test(t)) return false;
  return true;
}

function seed(title) {
  return `dit-${SOURCE_KEY}-${crypto.createHash("sha1").update(title.toLowerCase()).digest("hex").slice(0, 14)}`;
}

/** Minimal CSV parser that handles quoted fields and newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

console.log("Fetching sheet…");
const res = await fetch(CSV_URL);
if (!res.ok) {
  console.error("Fetch failed", res.status);
  process.exit(1);
}
const csv = await res.text();
const matrix = parseCsv(csv);

let headerIdx = -1;
for (let i = 0; i < matrix.length; i++) {
  const cols = matrix[i].map((c) => clean(c).toUpperCase());
  if (cols.includes("PROJECT TITLE") && cols.includes("S/NO")) {
    headerIdx = i;
    break;
  }
}
if (headerIdx < 0) {
  console.error("Could not find PROJECT TITLE header");
  process.exit(1);
}

const header = matrix[headerIdx].map((c) => clean(c).toUpperCase());
const titleCol = header.indexOf("PROJECT TITLE");
const nameCol = header.indexOf("FULL NAME");
const regCol = header.indexOf("REG. NUMBER");
const supCol = header.indexOf("SUPERVISOR");

const byNorm = new Map();
let parsed = 0;
let skippedEmpty = 0;

for (let i = headerIdx + 1; i < matrix.length; i++) {
  const cols = matrix[i];
  const rawTitle = clean(cols[titleCol] ?? "");
  if (!rawTitle) {
    skippedEmpty += 1;
    continue;
  }
  const title = titleCase(rawTitle);
  if (!okTitle(title)) {
    skippedEmpty += 1;
    continue;
  }
  parsed += 1;
  const norm = title.toLowerCase();
  if (byNorm.has(norm)) continue;

  const supervisor = clean(cols[supCol] ?? "");
  const student = clean(cols[nameCol] ?? "");
  const reg = clean(cols[regCol] ?? "");
  const commentParts = [
    supervisor ? `Supervisor: ${supervisor}` : null,
    student || reg ? `Listed student: ${[student, reg].filter(Boolean).join(" · ")}` : null,
  ].filter(Boolean);

  const t = clean(title, 280);
  const summary = clean(
    `DIT COE (Computer Engineering) project title: ${t}. Use this as a starting title — write a local problem statement, objectives, and prototype plan for your course.`,
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
    `Source list: ${ORIGIN}`,
    "Class: BENG22COE · Module: COU 08204 Project Realization · AY 2025/2026",
    ...commentParts.map((c) => `List note: ${c}`),
    "This entry is from a department title list (not a full report PDF).",
  ].join("\n");

  byNorm.set(norm, {
    seed_key: seed(t),
    batch: BATCH,
    origin_ref: ORIGIN,
    original_title: t,
    title: t,
    summary,
    hardware: null,
    communication: "COE / Computer Engineering",
    status: "available",
    institution: INSTITUTION,
    course_code: "COE",
    notes,
    updated_at: new Date().toISOString(),
  });
}

const rows = [...byNorm.values()];
console.log(`Parsed ${parsed} titled rows, unique ${rows.length}, skipped empty ${skippedEmpty}`);

let ok = 0;
let fail = 0;
for (const row of rows) {
  const { error } = await db.from("title_proposals").upsert(row, { onConflict: "seed_key" });
  if (error) {
    fail += 1;
    console.error("FAIL", row.title, error.message);
  } else {
    ok += 1;
    if (ok <= 6 || ok % 25 === 0 || ok === rows.length) {
      console.log(`OK ${ok}/${rows.length} · ${row.title}`);
    }
  }
}

const { count: total } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .neq("status", "dropped");
const { count: coe } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .eq("course_code", "COE")
  .neq("status", "dropped");

console.log(`Done. Imported/updated ${ok}, failed ${fail}.`);
console.log(`Total active titles: ${total}`);
console.log(`COE course_code titles: ${coe}`);
