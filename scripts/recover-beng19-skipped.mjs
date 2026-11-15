/**
 * Recover BENG PDFs skipped by strict import; also scrub leftover PROJ ECT TYPE suffixes.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const root = process.cwd();
for (const file of [".env.local"]) {
  for (const line of fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/)) {
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
const publicOrigin = (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || "https://share.honiccompany.com").replace(/\/$/, "");
const pdfDir = path.resolve(process.argv[2]);
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

function clean(s, max = 300) {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
function scrub(t) {
  return clean(t, 160)
    .replace(/\s+PROJ\s*ECT\s+TY\s*PE\b.*$/i, "")
    .replace(/\s+PROJECT\s+TY\s*PE\b.*$/i, "")
    .replace(/\s+PROJECT\s+TYPE\b.*$/i, "")
    .replace(/\s+CANDIDATE.*$/i, "")
    .replace(/\s+STUDENT[’']?S?\b.*$/i, "")
    .replace(/\s+NAME\s*(OF\s+STUDENT)?\s*[:\-–].*$/i, "")
    .replace(/\bLLOGGING\b/gi, "LOGGING")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*\.$/, "")
    .trim();
}
function good(t) {
  if (!t || t.length < 12 || t.length > 150) return false;
  if (/^(the|this|here|iv|abstract)\b/i.test(t)) return false;
  if (/\b(abstract|declaration|hereby|describes the)\b/i.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length <= 3 && words.every((w) => /^[A-Za-z.'’-]+$/.test(w))) return false;
  return /\b(system|iot|smart|design|automatic|monitor|device|machine|detection|control|based|alert|security|solar|traffic|network|app|sensor|meter|lock|water|ai|robot|gps|gsm|vending|irrigation|home|bus|school|glove|toll|cooling|packaging|feeding|stamp|soldier|vaccine|document|energy|railway|gate|payment|chatbot|insect|door|plate|hospital|blood|phone|driving|light|fish|drone|juice|coin|elephant|toilet|fuel|transport|harvest|cng|grass|card|garbage|detector|charging|women|pendrive|syndrome|corn|headlight|accident|forestry|rice|pond|bridge|tomato|disease|rfid|oscilloscope|book|soap|pesticide|enquiry|mobile|sanitary|caustic|transfer|navigation|evaporation|tubelight|weight|counter|measurement|sorting|mixing|recognition|authentication|recording|sharing|collection|cutting|protection|intelligence|washer|garden|locker|bridge|hospital|patient|comatose|cashew|quality|urine|ticket|liquid|speaking|impaired|factor|labeling|sorting|aquaculture|remote|secondary|counting|scare|image|processing|fault|pan|markets|transit|regional|conservation|ngv|non-garbage|vehicles|solar|alerts|computer|down|vehicle|rubber|car|illegal|rescuer|nearby|overload|food|plant|diseases|artificial)\b/i.test(
    t,
  );
}

async function textOf(file, pages = 2) {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= Math.min(pages, doc.numPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text.replace(/\u00a0/g, " ");
}

function parseTitle(text) {
  const patterns = [
    /PROJECT\s+TITLE\s*[:\-–]\s*([A-Z0-9][\s\S]{8,160}?)(?=\s+PROJECT\s+TY|\s+PROJECT\s+TYPE|\s+PROJ\s*ECT\s+TY|\s+NAME\s*[:\-–]|\s+NAME\s+OF|\s+CANDIDATE|\s+REG\s*NO|\s+STUDENT|\s+ACADEMIC|\s+SUPERVISOR)/i,
    /PROJECT\s+TITLE\s+([A-Z0-9][\s\S]{8,160}?)(?=\s+PROJECT\s+TY|\s+PROJECT\s+TYPE|\s+NAME\s*[:\-–]|\s+CANDIDATE|\s+REG\s*NO|\s+STUDENT)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const t = scrub(m[1]);
      if (good(t)) return t;
    }
  }
  return null;
}

function seedFor(fileName) {
  return `beng19-ete-${crypto.createHash("sha1").update(fileName.toLowerCase()).digest("hex").slice(0, 16)}`;
}

// Scrub existing bad suffixes
const { data: existing } = await db
  .from("title_proposals")
  .select("id, title, summary, notes")
  .like("seed_key", "beng19-ete-%")
  .neq("status", "dropped");
for (const row of existing ?? []) {
  const t = scrub(row.title);
  if (t !== row.title && good(t)) {
    await db
      .from("title_proposals")
      .update({
        title: t,
        original_title: t,
        summary: String(row.summary ?? "").replace(row.title, t).slice(0, 1800),
        notes: String(row.notes ?? "").replaceAll(row.title, t),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    console.log("SCRUB", row.title, "=>", t);
  } else if (!good(scrub(row.title))) {
    await db.from("title_proposals").update({ status: "dropped", updated_at: new Date().toISOString() }).eq("id", row.id);
    console.log("DROP_BAD", row.title);
  }
}

const { data: have } = await db.from("title_proposals").select("seed_key, title").like("seed_key", "beng19-ete-%").neq("status", "dropped");
const haveSeeds = new Set((have ?? []).map((r) => r.seed_key));
const haveTitles = new Set(
  (have ?? []).map((r) =>
    String(r.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
  ),
);

const files = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith(".pdf"));
let added = 0;
for (const file of files) {
  const seed = seedFor(file);
  if (haveSeeds.has(seed)) continue;
  try {
    const text = await textOf(path.join(pdfDir, file), 3);
    const title = parseTitle(text);
    if (!title) {
      console.log("STILL_SKIP", file);
      continue;
    }
    const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (haveTitles.has(norm)) {
      console.log("DUP", title);
      continue;
    }
    const storagePath = `catalogue/beng19-ete/${seed}.pdf`;
    const docUrl = `${publicOrigin}/api/portal/catalogue-docs/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
    await db.storage.from("portal-files").upload(storagePath, fs.readFileSync(path.join(pdfDir, file)), {
      contentType: "application/pdf",
      upsert: true,
    });
    const abstractMatch = text.match(/ABSTRACT\s+([\s\S]{80,1400}?)(?=\s+(?:CHAPTER|TABLE\s+OF|ACKNOWLEDG|LIST\s+OF|1\.\s*INTRODUCTION))/i);
    const summary = clean(
      abstractMatch?.[1] ||
        `BEng ETE project report (DIT): ${title}. Open the attached PDF for the full explanation, objectives, and design.`,
      1800,
    );
    await db.from("title_proposals").upsert(
      {
        seed_key: seed,
        batch: "BENG 19 ETE",
        origin_ref: docUrl,
        original_title: title,
        title,
        summary,
        communication: "Electronics and Telecommunications Engineering",
        status: "available",
        institution: "Dar es Salaam Institute of Technology (DIT)",
        course_code: "ETE",
        notes: `## Literature and source\nSource report (PDF): ${docUrl}\nBatch: BENG 19 ETE`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "seed_key" },
    );
    haveTitles.add(norm);
    haveSeeds.add(seed);
    added += 1;
    console.log("ADD", title);
  } catch (err) {
    console.error("FAIL", file, err.message);
  }
}

const { count: beng } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .like("seed_key", "beng19-ete-%")
  .neq("status", "dropped");
const { count: all } = await db.from("title_proposals").select("id", { count: "exact", head: true }).neq("status", "dropped");
console.log("DONE", { added, beng_active: beng, all_active: all });
