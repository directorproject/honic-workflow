/**
 * Import DIT BENG22ETE Min Two titles from BENG22ETE-MIN2.xlsx
 *
 *   node scripts/import-beng22ete-min2.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const XLSX_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "BENG22ETE-MIN2.xlsx",
);
const SOURCE_KEY = "beng22ete-min2-2025";
const BATCH = "DIT BENG22ETE Min Two 2025/2026";
const INSTITUTION = "Dar es Salaam Institute of Technology (DIT)";
const ORIGIN = "BENG22ETE-MIN2.xlsx";

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

if (!fs.existsSync(XLSX_PATH)) {
  console.error("Missing file:", XLSX_PATH);
  process.exit(1);
}

const py = `
import json, openpyxl
wb = openpyxl.load_workbook(r${JSON.stringify(XLSX_PATH)}, data_only=True)
out = []
for sheet_name in wb.sheetnames:
  ws = wb[sheet_name]
  header_row = None
  title_col = None
  name_col = None
  reg_col = None
  for i, row in enumerate(ws.iter_rows(values_only=True), 1):
    vals = [("" if v is None else str(v).strip()) for v in row]
    upper = [v.upper() for v in vals]
    if "PROJECT TITLE" in upper:
      header_row = i
      title_col = upper.index("PROJECT TITLE")
      name_col = upper.index("FULL NAME") if "FULL NAME" in upper else 2
      reg_col = upper.index("REG. NUMBER") if "REG. NUMBER" in upper else 1
      break
  if header_row is None:
    continue
  for i, row in enumerate(ws.iter_rows(values_only=True), 1):
    if i <= header_row:
      continue
    vals = [("" if v is None else str(v).replace("\\n", " ").strip()) for v in row]
    title = vals[title_col] if title_col < len(vals) else ""
    if not title:
      continue
    out.append({
      "panel": sheet_name,
      "title": title,
      "name": vals[name_col] if name_col < len(vals) else "",
      "reg": vals[reg_col] if reg_col < len(vals) else "",
    })
print(json.dumps(out, ensure_ascii=False))
`;

const extracted = spawnSync("python", ["-c", py], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
if (extracted.status !== 0) {
  console.error(extracted.stderr || extracted.stdout);
  process.exit(1);
}

const items = JSON.parse(extracted.stdout.trim());
console.log(`Extracted ${items.length} titled rows from ${path.basename(XLSX_PATH)}`);

const byNorm = new Map();
for (const item of items) {
  const title = titleCase(item.title);
  if (!okTitle(title)) continue;
  const norm = title.toLowerCase();
  if (byNorm.has(norm)) continue;

  const t = clean(title, 280);
  const commentParts = [
    item.panel ? `Panel: ${item.panel}` : null,
    item.name || item.reg ? `Listed student: ${[clean(item.name), clean(item.reg)].filter(Boolean).join(" · ")}` : null,
  ].filter(Boolean);

  const summary = clean(
    `DIT ETE Min Two project title: ${t}. Use this as a starting title — write a local problem statement, objectives, and prototype plan for your course.`,
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
    "Class: BENG22ETE · Min Two project presentation · AY 2025/2026 · NTA Level 8",
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
    communication: "ETE / Electronics & Telecommunication",
    status: "available",
    institution: INSTITUTION,
    course_code: "ETE",
    notes,
    updated_at: new Date().toISOString(),
  });
}

const rows = [...byNorm.values()];
console.log(`Unique titles to upsert: ${rows.length}`);

let ok = 0;
let fail = 0;
for (const row of rows) {
  const { error } = await db.from("title_proposals").upsert(row, { onConflict: "seed_key" });
  if (error) {
    fail += 1;
    console.error("FAIL", row.title, error.message);
  } else {
    ok += 1;
    if (ok <= 6 || ok % 15 === 0 || ok === rows.length) {
      console.log(`OK ${ok}/${rows.length} · ${row.title}`);
    }
  }
}

const { count: total } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .neq("status", "dropped");

console.log(`Done. Imported/updated ${ok}, failed ${fail}.`);
console.log(`Total active titles: ${total}`);
