/**
 * Import DIT Lab Tech (BT22LS) Mini I titles from Chemistry / Physics / Biology assessment forms.
 *
 *   node scripts/import-dit-labtech-forms.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const FILES = [
  {
    path: path.resolve(process.cwd(), "..", "..", "Assessment_Form_Chemistry.docx"),
    track: "Chemistry",
  },
  {
    path: path.resolve(process.cwd(), "..", "..", "Assessmen_Form_Physics.docx"),
    track: "Physics",
  },
  {
    path: path.resolve(process.cwd(), "..", "..", "Assesment_Form_Biology.docx"),
    track: "Biology",
  },
];

const SOURCE_KEY = "bt22ls-mini1-2025";
const BATCH = "DIT BT22LS Lab Tech Final Year 2025/2026";
const INSTITUTION = "Dar es Salaam Institute of Technology (DIT)";
/** Matches public.courses: Science and Laboratory Technology */
const COURSE = "SLT";

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
      .replace(/\b(And|Or|Of|For|The|In|On|With|To|A|An|From|Due)\b/g, (m) => m.toLowerCase())
      .replace(/^[a-z]/, (m) => m.toUpperCase());
  }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function okTitle(t) {
  if (!t) return false;
  const s = t.toLowerCase();
  if (s.length < 12 || s.length > 280) return false;
  if (/^(sno|student name|project title|the research title|objectives|methodology|significance|presentation)/i.test(s))
    return false;
  if (/\(\d+%\)\s*$/.test(s)) return false;
  if (!/[a-z]/i.test(t) || !/\s/.test(t)) return false;
  return true;
}

function seed(title) {
  return `dit-${SOURCE_KEY}-${crypto.createHash("sha1").update(title.toLowerCase()).digest("hex").slice(0, 14)}`;
}

const py = `
import json
from docx import Document
from pathlib import Path

files = ${JSON.stringify(FILES)}
out = []
for f in files:
  p = Path(f["path"])
  if not p.exists():
    raise SystemExit(f"Missing: {p}")
  doc = Document(str(p))
  for table in doc.tables:
    header = None
    title_col = None
    name_col = None
    for ri, row in enumerate(table.rows):
      cells = [c.text.replace("\\n", " ").strip() for c in row.cells]
      uniq = []
      for c in cells:
        if not uniq or uniq[-1] != c:
          uniq.append(c)
      upper = [u.upper() for u in uniq]
      if header is None and any("PROJECT TITLE" == u for u in upper):
        header = ri
        title_col = next(i for i,u in enumerate(upper) if u == "PROJECT TITLE")
        name_col = next((i for i,u in enumerate(upper) if "STUDENT" in u and "NAME" in u), 1)
        continue
      if header is None:
        continue
      if title_col is None or title_col >= len(uniq):
        continue
      title = uniq[title_col]
      if not title or title.upper() == "PROJECT TITLE":
        continue
      if "research title" in title.lower() and "research problem" in title.lower():
        continue
      name = uniq[name_col] if name_col is not None and name_col < len(uniq) else ""
      out.append({"track": f["track"], "title": title, "name": name, "file": p.name})
print(json.dumps(out, ensure_ascii=False))
`;

const extracted = spawnSync("python", ["-c", py], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});
if (extracted.status !== 0) {
  console.error(extracted.stderr || extracted.stdout);
  process.exit(1);
}

const items = JSON.parse(extracted.stdout.trim());
console.log(`Extracted ${items.length} titled rows from 3 Lab Tech forms`);

const byNorm = new Map();
let parsed = 0;
for (const item of items) {
  const title = titleCase(item.title);
  if (!okTitle(title)) continue;
  parsed += 1;
  const norm = title.toLowerCase();
  if (byNorm.has(norm)) continue;

  const t = clean(title, 280);
  const track = item.track;
  const commentParts = [
    `Track: ${track}`,
    item.name ? `Listed student: ${clean(item.name)}` : null,
  ].filter(Boolean);

  const summary = clean(
    `DIT Laboratory Science & Technology (${track}) final year project title: ${t}. Use this as a starting title — write a local problem statement, objectives, and lab/prototype plan for your course.`,
    1800,
  );
  const notes = [
    "## Main objective",
    `Design, implement, and evaluate a working solution for: ${t}.`,
    "",
    "## Specific objectives",
    "1. Survey related work and prior student projects on this theme.",
    "2. Write a clear problem statement and requirements for your campus or community context.",
    "3. Design and run lab methods or build a prototype, then test against the requirements.",
    "4. Document results, limits, and recommendations.",
    "",
    "## Literature and source",
    `Source list: ${item.file}`,
    "Class: BT22LS · Module: LSU 08106 Results/Progress Reporting · Final year project · AY 2025/2026",
    `Department: Laboratory Science and Technology · Track: ${track}`,
    ...commentParts.map((c) => `List note: ${c}`),
    "This entry is from a department assessment form (not a full report PDF).",
  ].join("\n");

  byNorm.set(norm, {
    seed_key: seed(t),
    batch: BATCH,
    origin_ref: item.file,
    original_title: t,
    title: t,
    summary,
    hardware: null,
    communication: `Lab Tech / ${track}`,
    status: "available",
    institution: INSTITUTION,
    course_code: COURSE,
    notes,
    updated_at: new Date().toISOString(),
  });
}

const rows = [...byNorm.values()];
console.log(`Parsed ${parsed}, unique ${rows.length}`);

let ok = 0;
let fail = 0;
for (const row of rows) {
  const { error } = await db.from("title_proposals").upsert(row, { onConflict: "seed_key" });
  if (error) {
    fail += 1;
    console.error("FAIL", row.title, error.message);
  } else {
    ok += 1;
    if (ok <= 6 || ok % 20 === 0 || ok === rows.length) {
      console.log(`OK ${ok}/${rows.length} · ${row.title}`);
    }
  }
}

const { count: total } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .neq("status", "dropped");
const { count: ls } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .eq("course_code", COURSE)
  .neq("status", "dropped");

console.log(`Done. Imported/updated ${ok}, failed ${fail}.`);
console.log(`Total active titles: ${total}`);
console.log(`Lab Tech (${COURSE}) titles: ${ls}`);
