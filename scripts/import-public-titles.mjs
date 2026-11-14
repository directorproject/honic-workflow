/**
 * Import project titles from public institute PDFs / pages into title_proposals.
 * Fills summary (problem), notes (objectives + literature), and origin_ref (approach URL)
 * so students can read something useful when they open a title.
 * Sources under data/titles-import/
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
  console.error("Missing Supabase admin env");
  process.exit(1);
}

const DIR = path.join(process.cwd(), "data", "titles-import");
const SKIP = new Set([
  "project title",
  "title",
  "s.no",
  "roll no",
  "name of the student",
  "guide",
  "batch no",
  "student name",
  "in house",
  "project coordinator",
  "academic in",
  "charge",
]);

function clean(s, max = 300) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/[|\[\]]/g, " ")
    .trim()
    .slice(0, max);
}

function okTitle(t) {
  if (!t) return false;
  const s = t.toLowerCase();
  if (s.length < 10 || s.length > 280) return false;
  if (SKIP.has(s)) return false;
  if (/^(dr|ms|mr|mrs|prof)\b/.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  if (/roll no|department of|institute of|university|batch|coordinator/.test(s)) return false;
  if (!/[a-z]/i.test(t) || !/\s/.test(t)) return false;
  return true;
}

function seed(title, source) {
  return `pub-${source}-${crypto.createHash("sha1").update(title.toLowerCase()).digest("hex").slice(0, 14)}`;
}

function topicPhrase(title) {
  const t = clean(title, 200);
  const lower = t.charAt(0).toLowerCase() + t.slice(1);
  return /^(a|an|the)\s/i.test(lower) ? lower : `a project on ${lower}`;
}

function defaultSpecific(hasDoc) {
  const lines = [
    "1. Survey related work and public sources for this topic (papers, open repos, prior student projects).",
    "2. Write a clear problem statement and requirements suited to your course and local context.",
    "3. Design and build a working prototype, then test it against the requirements.",
    "4. Document results, limits, and recommendations for future work.",
  ];
  if (!hasDoc) {
    lines[0] =
      "1. Use the linked public title list or institute page as a starting point, then search journals and open reports for related literature.";
  }
  return lines.join("\n");
}

function buildBrief({ title, description, institution, origin, docUrl, rich }) {
  const where = institution ? ` (${institution})` : "";
  const approach = docUrl || origin;
  const problem =
    description ||
    (rich
      ? `This title comes from a public project idea bank${where}. ${description || ""} Adapt the idea to your course and write a local problem statement.`
      : `Public title lists${where} published this topic without a full report. Use it as inspiration: study the gap around ${topicPhrase(title)}, then write a problem statement that fits your department and setting.`);

  const objectives =
    rich && description
      ? `Design, implement, and evaluate ${topicPhrase(title)}, following the idea outline from the source.`
      : `Design, implement, and evaluate ${topicPhrase(title)}, adapted to your course requirements.`;

  const literature = [
    approach ? `Source / approach link: ${approach}` : null,
    rich
      ? "Open the linked page or repository for the original idea write-up or project materials (access may vary)."
      : "The public source is a title list only. Treat the link as where the title was published; build your own literature review from papers and open materials on the same theme.",
  ]
    .filter(Boolean)
    .join("\n");

  const notes = [
    "## Main objective",
    objectives,
    "",
    "## Specific objectives",
    defaultSpecific(Boolean(docUrl && rich)),
    "",
    "## Literature and source",
    literature,
  ].join("\n");

  return {
    summary: clean(problem, 1800),
    notes,
    origin_ref: approach || origin || null,
  };
}

function add(out, title, meta) {
  const t = clean(title, 280);
  if (!okTitle(t)) return;
  const key = seed(t, meta.sourceKey);
  if (out.has(key)) return;
  const brief = buildBrief({
    title: t,
    description: meta.summary ?? null,
    institution: meta.institution,
    origin: meta.origin,
    docUrl: meta.docUrl ?? null,
    rich: Boolean(meta.rich),
  });
  out.set(key, {
    seed_key: key,
    batch: meta.batch,
    origin_ref: brief.origin_ref,
    original_title: t,
    title: t,
    summary: brief.summary,
    hardware: null,
    communication: meta.domain ?? null,
    status: "available",
    institution: meta.institution,
    course_code: meta.course,
    notes: brief.notes,
    updated_at: new Date().toISOString(),
  });
}

function parseMgit(text, out) {
  const meta = {
    sourceKey: "mgit",
    batch: "MGIT CSE 2021-22",
    origin: "https://mgit.ac.in/",
    institution: "Mahatma Gandhi Institute of Technology (MGIT)",
    course: "COE",
    domain: "CSE mini project",
  };
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const joined = [];
  for (const line of lines) {
    if (/^\d+\s+[0-9A-Za-z]{8,}/.test(line) || joined.length === 0) joined.push(line);
    else joined[joined.length - 1] += " " + line;
  }
  for (const line of joined) {
    const head = line.match(/^\d+\s+[0-9A-Za-z]+\s+(.+)$/);
    if (!head) continue;
    const rest = head[1];
    const g =
      rest.match(/\b(?:Dr\.?|Ms\.|Mr\.|Mrs\.|Prof\.?)\s+[A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*){0,2}\s+(.+)$/i) ||
      rest.match(/\b[a-z]\.[A-Za-z]+\s+(.+)$/) ||
      rest.match(/\b[A-Z]\.[A-Za-z]+(?:\s+[A-Za-z]+){0,2}\s+(.+)$/);
    if (g) add(out, g[1], meta);
  }
}

const NITT_TITLE_HINT =
  /^(Custom|Yellow|Online|Performance|Oracle|Utility|Platform|Quality|Agripedia|Video|Outbound|Smart|learner|Lender|DATAPATH|Communication|Generic|zoho|Click|Jugnoo|GTEQ|QRadar|APR|TruVantagr|Medical|Automation|Company|Po2pay|Concept|Hostel|mSupply|Campaign|Car|Application|Matrix|Matrimonial|Traffic|Continuous|Integration|Payee|Android|Set|IoT|AI|Web|Secure|Face|Stock|Crop|Skin|Fake|Password|Black|Time|Certificate|Desktop|CNN|Examination|Picture|Rock|Photosketching|BRENT|CUSTOMER|Pulmonary|SONAR|Youtube|Securing|Analysis|Design|Development|Implementation|Enhancing|Lightweight|Exploring|Adaptive|Quantum|Deception|LockBox|Open source|A-MAC|MTD|Automated|An Integrated|Upgrading)/i;

function extractNittMcaTitle(line) {
  const m = clean(line, 500).match(/^\d+\s+20\d{2}\s+\d+\s+(.+)$/i);
  if (!m) return null;
  let rest = m[1];
  rest = rest
    .replace(/\s+(?:Dr\.?|DR\.?|Mrs\.?|Mr\.?|Prof\.?|Michael Arock|A V Reddy|A\.V\. Reddy|Eswari)\b.*$/i, "")
    .trim();
  const words = rest.split(/\s+/).filter(Boolean);
  if (words.length < 3) return null;
  let best = words.slice(2).join(" ");
  for (let drop = 2; drop <= Math.min(4, words.length - 2); drop += 1) {
    const cand = words.slice(drop).join(" ");
    if (NITT_TITLE_HINT.test(cand)) {
      best = cand;
      break;
    }
  }
  return clean(best, 280);
}

function parseNittMca(text, out) {
  const meta = {
    sourceKey: "nitt-mca",
    batch: "NIT Trichy MCA 2017",
    origin: "https://www.nitt.edu/",
    institution: "National Institute of Technology, Tiruchirappalli",
    course: "COE",
    domain: "MCA",
  };
  for (const line of text.split(/\r?\n/)) {
    const t = extractNittMcaTitle(line);
    if (t) add(out, t, meta);
  }
}

function parseNittEce(text, out) {
  const meta = {
    sourceKey: "nitt-ece",
    batch: "NIT Trichy ECE UG",
    origin: "https://www.nitt.edu/",
    institution: "National Institute of Technology, Tiruchirappalli",
    course: "ETE",
    domain: "ECE",
  };
  const re = /^(.+?)\s+(\d{4})\s*$/;
  for (const raw of text.split(/\r?\n/)) {
    const line = clean(raw, 320);
    const m = line.match(re);
    if (!m) continue;
    let body = m[1];
    body = body.replace(/\s+[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z]\s?[A-Z]?)?$/, "").trim();
    add(out, body, { ...meta, batch: `NIT Trichy ECE ${m[2]}` });
  }
}

function parseAmrita(md, out) {
  const listOrigin = "https://github.com/amrita-tifac-cys-btech/2022-26";
  const base = {
    sourceKey: "amrita-cys",
    batch: "Amrita CYS 2022-26",
    origin: listOrigin,
    institution: "Amrita Vishwa Vidyapeetham (TIFAC-CORE Cyber Security)",
    course: "COE",
    domain: "Cybersecurity",
    rich: true,
  };
  // Title cell links: [Title](https://github.com/amrita-tifac-cys-btech/Repo)
  const re = /\[([^\]]{10,200})\]\((https:\/\/github\.com\/amrita-tifac-cys-btech\/[^)]+)\)/g;
  let m;
  while ((m = re.exec(md))) {
    const t = clean(m[1].replace(/^LockBox:\s*/i, "LockBox: "), 280);
    if (/^22UCYS#/i.test(t)) continue;
    const docUrl = m[2];
    add(out, t, {
      ...base,
      docUrl,
      summary: `Cybersecurity project listed by Amrita TIFAC-CORE. Open the batch catalogue (${listOrigin}) and the project page (${docUrl}) for materials. Some repos are private; if a link fails, use the title for literature search and adapt the problem to your course.`,
    });
  }
}

function parseAcmHtml(html, out) {
  const meta = {
    sourceKey: "acm-uab",
    batch: "ACM UAB project ideas",
    origin: "https://acmatuab.org/ideas/",
    institution: null,
    course: "COE",
    domain: "CS project ideas",
    rich: true,
    docUrl: "https://acmatuab.org/ideas/",
  };
  const blocks = [...html.matchAll(/<p>\s*<strong>([^<]{6,160})<\/strong>\s*:?\s*([^<]*)<\/p>/gi)];
  for (const m of blocks) {
    const title = clean(m[1].replace(/[:.]\s*$/, ""), 200);
    const detail = clean(m[2], 900);
    if (!okTitle(title)) continue;
    add(out, title, {
      ...meta,
      summary: detail
        ? `${detail} Source idea bank: ACM @ UAB (https://acmatuab.org/ideas/). Adapt this outline into a formal problem statement for your course.`
        : null,
    });
  }
}

function parseAissms(html, out) {
  const meta = {
    sourceKey: "aissms",
    batch: "AISSMS COE Electronics",
    origin: "https://aissmscoe.com/electronics-engineering/academics/students-projects/",
    institution: "AISSMS College of Engineering, Pune",
    course: "ETE",
    domain: "Electronics",
    docUrl: "https://aissmscoe.com/electronics-engineering/academics/students-projects/",
  };
  const cells = [...html.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
    clean(m[1].replace(/<[^>]+>/g, " "), 200),
  );
  for (const c of cells) {
    if (!okTitle(c)) continue;
    if (/^\d+$/.test(c)) continue;
    if (/dr\.|prof\.|mr\.|ms\./i.test(c) && c.split(" ").length <= 4) continue;
    if (c.split(" ").length >= 3) add(out, c, meta);
  }
}

function parseBiet(text, out) {
  const meta = {
    sourceKey: "biet",
    batch: "BIET CSE 2018-19",
    origin: "https://biet.ac.in/pdfs/projecttitles/IV%20CSE-A%20PROJECT%20TITLES.pdf",
    institution: "Bharat Institute of Engineering and Technology (BIET)",
    course: "COE",
    domain: "CSE",
    docUrl: "https://biet.ac.in/pdfs/projecttitles/IV%20CSE-A%20PROJECT%20TITLES.pdf",
  };
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const t = clean(buf.join(" "), 280);
    buf = [];
    if (okTitle(t) && !/CSA\d|Associate Professor|Assistant Professor|COORDINATOR/i.test(t)) add(out, t, meta);
  };
  for (const line of lines) {
    if (/^\d{2}E\d|Batch No|Roll No|Student Name|PROJECT COORDINATOR|CSA\d|Dr\.|Associate|Assistant Professor/i.test(line)) {
      flush();
      continue;
    }
    if (/^[A-Za-z]/.test(line) && line.length > 8) {
      buf.push(line);
      if (!/-\s*$/.test(line) && buf.join(" ").length > 25) flush();
    } else flush();
  }
  flush();
}

const out = new Map();
const read = (name) => fs.readFileSync(path.join(DIR, name), "utf8");

if (fs.existsSync(path.join(DIR, "mgit-cse-mini.txt"))) parseMgit(read("mgit-cse-mini.txt"), out);
if (fs.existsSync(path.join(DIR, "nitt-mca-2017.txt"))) parseNittMca(read("nitt-mca-2017.txt"), out);
if (fs.existsSync(path.join(DIR, "nitt-ece-btech.txt"))) parseNittEce(read("nitt-ece-btech.txt"), out);
if (fs.existsSync(path.join(DIR, "amrita-cys-readme.md"))) parseAmrita(read("amrita-cys-readme.md"), out);
if (fs.existsSync(path.join(DIR, "acm-uab-ideas.html"))) parseAcmHtml(read("acm-uab-ideas.html"), out);
if (fs.existsSync(path.join(DIR, "aissmscoe.html"))) parseAissms(read("aissmscoe.html"), out);
if (fs.existsSync(path.join(DIR, "biet-cse-a.txt"))) parseBiet(read("biet-cse-a.txt"), out);

const rows = [...out.values()];
console.log("PARSED", rows.length);
const withSummary = rows.filter((r) => r.summary).length;
const withLink = rows.filter((r) => r.origin_ref && /^https?:\/\//i.test(r.origin_ref)).length;
console.log("WITH_SUMMARY", withSummary, "WITH_LINK", withLink);

const by = {};
for (const r of rows) {
  const k = r.seed_key.split("-")[1];
  by[k] = (by[k] || 0) + 1;
}
console.log("BY_SOURCE", JSON.stringify(by));

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const chunk = 80;
let upserted = 0;
for (let i = 0; i < rows.length; i += chunk) {
  const part = rows.slice(i, i + chunk);
  const { error, count } = await db.from("title_proposals").upsert(part, { onConflict: "seed_key", count: "exact" });
  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }
  upserted += count ?? part.length;
  console.log(`Upserted ${Math.min(i + chunk, rows.length)} / ${rows.length}`);
}

const { count } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .like("seed_key", "pub-%");

console.log("DONE");
console.log("IMPORTED", upserted);
console.log("PUBLIC_IMPORT_ROWS_IN_DB", count);
