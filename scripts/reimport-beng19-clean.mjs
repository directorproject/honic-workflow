/**
 * Drop existing beng19-ete titles and re-import with strict title parsing.
 *
 *   node scripts/reimport-beng19-clean.mjs [pdf-folder]
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
const publicOrigin = (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "https://share.honiccompany.com").replace(
  /\/$/,
  "",
);
const pdfDir = path.resolve(process.argv[2]);
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
const BUCKET = "portal-files";

function clean(s, max = 300) {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function scrub(raw) {
  return clean(raw, 200)
    .replace(/\s+PROJECT\s+TY\s*PE\b.*$/i, "")
    .replace(/\s+PROJECT\s+TYPE\b.*$/i, "")
    .replace(/\s+CANDIDATE.*$/i, "")
    .replace(/\s+STUDENT[’']?S?\b.*$/i, "")
    .replace(/\s+NAME\s*(OF\s+STUDENT)?\s*[:\-–].*$/i, "")
    .replace(/\s+REG\s*NO\b.*$/i, "")
    .replace(/\bINTELLIG\s*E\s*NT\b/gi, "INTELLIGENT")
    .replace(/\bCONSU\s*M\s*PTION\b/gi, "CONSUMPTION")
    .replace(/\bAUTO\s*MATIC\b/gi, "AUTOMATIC")
    .replace(/\bD\s*R\s*ONE\b/gi, "DRONE")
    .replace(/\bA\s*R\s*EPORT\b/gi, "REPORT")
    .replace(/\bFOREST\s*RY\b/gi, "FORESTRY")
    .replace(/\bLLOGGING\b/gi, "LOGGING")
    .replace(/\bSYSTE\s*M\b/gi, "SYSTEM")
    .replace(/\bFACTOR\s*S\b/gi, "FACTOR")
    .replace(/\bPRERE\s*QUISITE\b/gi, "PREREQUISITE")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*\.$/, "")
    .trim();
}

function isGoodTitle(t) {
  if (!t || t.length < 15 || t.length > 140) return false;
  if (/^(the|this|here|iv|i+|abstract)\b/i.test(t)) return false;
  if (/\b(abstract|declaration|certification|hereby|describes the work)\b/i.test(t)) return false;
  if (/[,:;].{40,}/.test(t) && /\b(the|and|of|in|to|for|with|that|which)\b/i.test(t) && t.length > 100) return false;
  const words = t.split(/\s+/);
  if (words.length <= 4 && words.every((w) => /^[A-Za-z][A-Za-z.'’-]*$/.test(w))) return false;
  return /\b(system|iot|smart|design|automatic|monitor|device|machine|detection|control|using|based|alert|tracking|payment|security|solar|traffic|network|app|vending|sorting|irrigation|navigation|gps|gsm|ai|robot|sensor|meter|glove|lock|toll|cooling|packaging|feeding|stamp|oscilloscope|water|rail|gate|chatbot|insect|glove|plate|hospital|blood|phone|driving|light|hot\s*plate|fish|drone|juice|coin|elephant|evaporation|image|tubelight|toilet|fuel|transport|harvest|cng|grass|card|garbage|detector|charging|women|pendrive|syndrome|corn|headlight|accident|forestry|logging|rice|pond|bridge|tomato|disease|bus|school|home|irrigation|fingerprint|soldier|vaccine|document|student|energy|comatose|cashew|quality|urine|ticket|book|soap|pesticide|enquiry|door|mobile|rfid|sanitary|caustic|washer|transfer|prerequisite)\b/i.test(
    t,
  );
}

async function pageText(filePath, maxPages = 2) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= Math.min(maxPages, doc.numPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text;
}

function parseTitle(text) {
  const re =
    /PROJECT\s+TITLE\s*[:\-–]?\s*([\s\S]{10,180}?)(?=\s+PROJECT\s+TY|\s+PROJECT\s+TYPE|\s+NAME\s*[:\-–]|\s+NAME\s+OF\s+STUDENT|\s+CANDIDATE|\s+REG\s*NO|\s+STUDENT|\s+ACADEMIC\s+YEAR|\s+SUPERVISOR)/i;
  const m = text.match(re);
  if (m?.[1]) {
    const t = scrub(m[1]);
    if (isGoodTitle(t)) return t;
  }
  return null;
}

function parseAbstract(text) {
  const m = text.match(/ABSTRACT\s+([\s\S]{100,1600}?)(?=\s+(?:CHAPTER|TABLE\s+OF|ACKNOWLEDG|LIST\s+OF|1\.\s*INTRODUCTION))/i);
  if (m?.[1]) return clean(m[1], 1500);
  return null;
}

function seedFor(fileName) {
  return `beng19-ete-${crypto.createHash("sha1").update(fileName.toLowerCase()).digest("hex").slice(0, 16)}`;
}

// Drop previous beng imports
const now = new Date().toISOString();
const { data: old } = await db.from("title_proposals").select("id").like("seed_key", "beng19-ete-%").neq("status", "dropped");
if (old?.length) {
  await db
    .from("title_proposals")
    .update({ status: "dropped", updated_at: now })
    .in(
      "id",
      old.map((r) => r.id),
    );
  console.log("Dropped previous beng19 rows", old.length);
}

const files = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
const seen = new Set();
let ok = 0;
let skip = 0;

for (const file of files) {
  const full = path.join(pdfDir, file);
  try {
    const text = await pageText(full, 3);
    const title = parseTitle(text);
    if (!title) {
      skip += 1;
      console.log("SKIP", file);
      continue;
    }
    const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(norm)) {
      skip += 1;
      console.log("DUP", title);
      continue;
    }
    seen.add(norm);

    const abstract = parseAbstract(text);
    const seed = seedFor(file);
    const storagePath = `catalogue/beng19-ete/${seed}.pdf`;
    const docUrl = `${publicOrigin}/api/portal/catalogue-docs/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
    const bytes = fs.readFileSync(full);
    const { error: upErr } = await db.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);

    const summary =
      abstract ||
      `BEng ETE project report (DIT): ${title}. Open the attached PDF for the full explanation, objectives, and design.`;

    const notes = [
      "## Main objective",
      `Study and adapt the BEng ETE project “${title}” using the attached report as prior work.`,
      "",
      "## Specific objectives",
      "1. Read the attached project report and extract the problem, objectives, and method.",
      "2. Identify what to improve or localise for your own OD / BEng requirements.",
      "3. Design and build your prototype, then test it against those requirements.",
      "4. Document results, limits, and recommendations.",
      "",
      "## Literature and source",
      `Source report (PDF): ${docUrl}`,
      "Institution: Dar es Salaam Institute of Technology (DIT), Department of Electronics and Telecommunications Engineering.",
      "Batch: BENG 19 ETE",
    ].join("\n");

    const { error: dbErr } = await db.from("title_proposals").upsert(
      {
        seed_key: seed,
        batch: "BENG 19 ETE",
        origin_ref: docUrl,
        original_title: title,
        title,
        summary: clean(summary, 1800),
        hardware: null,
        communication: "Electronics and Telecommunications Engineering",
        status: "available",
        institution: "Dar es Salaam Institute of Technology (DIT)",
        course_code: "ETE",
        notes,
        updated_at: now,
      },
      { onConflict: "seed_key" },
    );
    if (dbErr) throw new Error(dbErr.message);
    ok += 1;
    console.log(`OK ${ok} · ${title}`);
  } catch (err) {
    skip += 1;
    console.error("FAIL", file, err.message);
  }
}

// Final cleanup: unfit / no-source / duplicates across catalogue
const { spawnSync } = await import("node:child_process");
spawnSync(process.execPath, ["scripts/cleanup-titles-od-beng.mjs"], { stdio: "inherit", cwd: projectRoot });

const { count: left } = await db.from("title_proposals").select("id", { count: "exact", head: true }).neq("status", "dropped");
const { count: beng } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .like("seed_key", "beng19-ete-%")
  .neq("status", "dropped");

console.log("DONE", { imported: ok, skipped: skip, beng_active: beng, all_active: left });
