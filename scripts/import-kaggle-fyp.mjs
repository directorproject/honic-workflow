/**
 * Import Kaggle "Past FYP Data" into title_proposals (OD/BEng-filtered).
 *
 * Usage:
 *   node scripts/import-kaggle-fyp.mjs [path/to/FYP Data.csv]
 *
 * Default CSV path: data/kaggle/FYP Data.csv
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const csvPath = path.resolve(process.argv[2] || path.join(process.cwd(), "data", "kaggle", "FYP Data.csv"));
if (!fs.existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}`);
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (c === "\n" || (c === "\r" && next === "\n")) {
      if (c === "\r") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (c === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function clean(s, max) {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max) : null;
}

function domainToCourse(domain, tech) {
  const d = `${domain ?? ""} ${tech ?? ""}`.toLowerCase();
  if (/iot|embed|arduino|raspberry|esp32|esp8266|hardware|robot|sensor|antenna|pcb|fpga|electronics|telecommunication|electrical/.test(d)) {
    return "ETE";
  }
  if (/cyber|network|security|computer|software|ai|ml|vision|image|web|mobile|cloud/.test(d)) return "COE";
  return "COE";
}

/** Keep titles a Tanzanian OD / BEng student can adapt. */
function fitsOdBeng(title, domain, tech, abstract) {
  const blob = `${title} ${domain} ${tech} ${abstract}`.toLowerCase();
  if (!title || title.length < 10) return false;

  // Hard reject
  if (
    /\b(vr museum|virtual reality museum|job market scraper|fake news|social media sentiment|dating app|matrimonial|stock trading bot|crypto trading|nft marketplace|ecommerce blog|todo app|portfolio website|text adventure|simple calculator)\b/.test(
      blob,
    )
  ) {
    return false;
  }
  if (/\b(pure finance|hedge fund|forex)\b/.test(blob) && !/\biot|sensor|embed/.test(blob)) return false;

  const keepHint =
    /\b(iot|internet of things|arduino|raspberry|esp32|esp8266|sensor|embed|robot|drone|antenna|pcb|fpga|plc|solar|grid|battery|motor|power|electr|telecommunication|wireless|rfid|nfc|bluetooth|mqtt|nodemcu|stm32|healthcare monitor|patient monitor|attendance|water|waste|farm|agricultur|irrigation|parking|traffic|security lock|surveillance|face recognition|biometric|fire|flood|smart home|smart city|wearable|ecg|heart rate|cyber|firewall|phishing|intrusion|password|encrypt|network|vision|opencv|yolo|image process|waste|toll|street light|charging|ev\b)/i.test(
      blob,
    );

  const domainOk =
    /\b(iot|embed|hardware|robot|electr|cyber|network|security|computer vision|image|ai\b|ml\b|machine learning|deep learning)\b/i.test(
      String(domain ?? ""),
    ) || keepHint;

  return Boolean(domainOk && keepHint);
}

function topicPhrase(title) {
  const t = clean(title, 200) || "this topic";
  const lower = t.charAt(0).toLowerCase() + t.slice(1);
  return /^(a|an|the)\s/i.test(lower) ? lower : `a project on ${lower}`;
}

function buildNotes({ title, abstract, domain, tech, source }) {
  const objectives = abstract
    ? `Design, implement, and evaluate ${topicPhrase(title)}, following the abstract from the source dataset.`
    : `Design, implement, and evaluate ${topicPhrase(title)}, adapted to your course and local context.`;
  const literature = [
    source ? `Source / approach link: ${source}` : "Source: Kaggle Past FYP Data (nabeelqureshitiii/past-fyp-data).",
    abstract
      ? "Use the abstract above as a starting problem outline, then build your own literature review and local requirements."
      : "Search papers and open repos on the same theme; adapt the idea to your department.",
    domain ? `Domain: ${domain}.` : null,
    tech ? `Suggested technologies: ${tech}.` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    "## Main objective",
    objectives,
    "",
    "## Specific objectives",
    "1. Review related work and the linked source (if available) for this topic.",
    "2. Write a clear problem statement and requirements suited to your course and local context.",
    "3. Design and build a working prototype, then test it against the requirements.",
    "4. Document results, limits, and recommendations for future work.",
    "",
    "## Literature and source",
    literature,
  ].join("\n");
}

const raw = fs.readFileSync(csvPath, "utf8");
const table = parseCsv(raw);
if (table.length < 2) {
  console.error("CSV looks empty.");
  process.exit(1);
}
const header = table[0].map((h) => h.trim().toLowerCase());
const idx = (name) => header.findIndex((h) => h === name || h.includes(name));
const iTitle = idx("title");
const iAbstract = idx("abstract");
const iDomain = idx("domain");
const iTech = idx("technologies");
const iYear = idx("year");
const iSource = idx("source");
if (iTitle < 0) {
  console.error("No title column. Headers:", header.join(", "));
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const rows = [];
const seen = new Set();
let skipped = 0;

for (const cols of table.slice(1)) {
  const title = clean(cols[iTitle], 300);
  if (!title || title.length < 8) {
    skipped += 1;
    continue;
  }
  const abstract = iAbstract >= 0 ? clean(cols[iAbstract], 2000) : null;
  const domain = iDomain >= 0 ? clean(cols[iDomain], 120) : null;
  const tech = iTech >= 0 ? clean(cols[iTech], 500) : null;
  const year = iYear >= 0 ? clean(cols[iYear], 20) : null;
  const source = iSource >= 0 ? clean(cols[iSource], 500) : null;
  const yearNum = year ? String(Math.floor(Number(year)) || year) : null;

  if (!fitsOdBeng(title, domain, tech, abstract)) {
    skipped += 1;
    continue;
  }

  const seedBase = `kaggle-fyp-${crypto.createHash("sha1").update(title.toLowerCase()).digest("hex").slice(0, 16)}`;
  if (seen.has(seedBase)) {
    skipped += 1;
    continue;
  }
  seen.add(seedBase);

  const origin = source && /^https?:\/\//i.test(source) ? source : "https://www.kaggle.com/datasets/nabeelqureshitiii/past-fyp-data";
  const problem =
    abstract ||
    `This title comes from the open Past FYP dataset. Adapt ${topicPhrase(title)} to your course and write a local problem statement.`;

  rows.push({
    seed_key: seedBase,
    batch: yearNum ? `Kaggle FYP ${yearNum}` : "Kaggle FYP",
    origin_ref: origin,
    original_title: title,
    title,
    summary: problem,
    hardware: tech,
    communication: domain,
    status: "available",
    institution: null,
    course_code: domainToCourse(domain, tech),
    notes: buildNotes({ title, abstract, domain, tech, source: origin }),
    updated_at: new Date().toISOString(),
  });
}

console.log(`Parsed keep=${rows.length} skip=${skipped} from ${path.basename(csvPath)}`);

const chunk = 80;
let upserted = 0;
for (let i = 0; i < rows.length; i += chunk) {
  const part = rows.slice(i, i + chunk);
  const { error, count } = await db.from("title_proposals").upsert(part, {
    onConflict: "seed_key",
    count: "exact",
  });
  if (error) {
    console.error(`Upsert failed at ${i}:`, error.message);
    process.exit(1);
  }
  upserted += count ?? part.length;
  console.log(`Upserted ${Math.min(i + chunk, rows.length)} / ${rows.length}`);
}

const { count } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .like("seed_key", "kaggle-fyp-%")
  .neq("status", "dropped");

console.log("DONE");
console.log("SOURCE", "https://www.kaggle.com/datasets/nabeelqureshitiii/past-fyp-data");
console.log("IMPORTED_OR_UPDATED", upserted);
console.log("KAGGLE_ACTIVE_IN_DB", count);
console.log("SAMPLE", rows.slice(0, 5).map((r) => r.title));
