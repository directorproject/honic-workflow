/**
 * Drop public titles that do not fit Tanzanian OD / BEng
 * (Electrical, Electronics, Computer Engineering style projects).
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await db
  .from("title_proposals")
  .select("id, title, batch, seed_key, course_code")
  .like("seed_key", "pub-%")
  .neq("status", "dropped");
if (error) throw new Error(error.message);

function reason(row) {
  const t = String(row.title ?? "").trim();
  const low = t.toLowerCase();
  const seed = String(row.seed_key ?? "");
  const batch = String(row.batch ?? "");

  // Too short / fragment / garbage tokens
  if (t.length < 12) return "too_short";
  if (/^title of (paper|project)$/i.test(t)) return "placeholder";
  if (/^names of authors$/i.test(t)) return "placeholder";
  if (/^(application|environment|safety|product|agriculture|societal|machine learning, image processing)$/i.test(t)) {
    return "category_label";
  }
  if (/doi:|ieee xplore|issn|e-issn|p-issn|impact factor|smsjournals|isteonline|pattern recognition, volume/i.test(t)) {
    return "citation";
  }
  if (/samriddhi|indian journal of technical education|international journal|international research journal|tensymp|conference paper/i.test(t)) {
    return "citation";
  }
  if (/\bpp\s*\d|vol\.?\s*\d|special issue|article id/i.test(t)) return "citation";
  if (/pvt\.?\s*ltd|llp|enterprises|industries|powertronics|express infra|parkomate|intangles|iocare|atomic enterprises|automate engineering|brand publicity|my future town|sunshine powertronics|spurt/i.test(t)) {
    return "company_name";
  }
  if (/aissms college of engineering|kennedy road, pune/i.test(t)) return "address";
  if (/&nbsp;|&#\d+;/.test(t) && t.replace(/&nbsp;|&#\d+;/g, "").trim().length < 20) return "html_junk";

  // Person-name only rows (2–4 capitalized name tokens, no project words)
  const words = t.replace(/&nbsp;/g, " ").split(/\s+/).filter(Boolean);
  const projectHint =
    /\b(system|iot|iot-|smart|design|detection|robot|cnn|ml|ai|android|web|network|sensor|monitor|automation|antenna|solar|elevator|flood|waste|health|security|image|deep|machine|control|wireless|pcb|cnc|drone|farm|water|blood|covid|voice|parking|mirror|grid|battery|glove|bot|app|platform|framework|protocol|fpga|filter|noise|super.?resolution|classification|recognition|attendance|management|tracker|dashboard|portal|store|shopping|shell|server|emulator|visualizer|solver|translator|prediction|segmentation|blockchain|vpn|firewall|password|crypt|malware|anomaly|quantum)\b/i.test(
      t,
    );
  if (!projectHint && words.length <= 5 && words.every((w) => /^[A-Z][a-zA-Z.'’-]*$/.test(w) || /^[A-Z]\.?$/.test(w))) {
    return "person_name";
  }
  if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(t) && !projectHint) return "person_name";
  // Author lists with commas of people
  if ((t.match(/,/g) || []).length >= 2 && !projectHint && words.length <= 12) return "author_list";

  // ACM idea-bank tutorials / docs / toy homework (not OD/BEng FYP)
  if (seed.includes("acm") || /acm uab/i.test(batch)) {
    if (
      /debug|tutorial|mdn web|geeksforgeeks|gnu c library|git tutorial|simple calculator|text-based adventure|to-do list|portfolio website|assembly programming tutorial|java tutorials/i.test(
        low,
      )
    ) {
      return "acm_tutorial_or_toy";
    }
  }

  // Industry-internal internship tools (NIT MCA etc.) — not local OD/BEng projects
  if (
    /oracle banking|obdx|informatica|hadoop security|sap iq|qradar|maaS3|wireshaping|ebeam inspector|off-cycle rewards|apr \(annual|lender panel|po2pay|mprocure|generic connector service|bytes to xml|release manager|compensation|teradata|zoho one|radisys|citicorp|morgan stanley|ofss|sandvine|kellton|magnitude software|aurigo|msupply|jugnoo tracking|customer panel|payee management|deep packet inspection, web qoe|datapath testing|packet forwarding|cloud based m2m|mdm \(mobile|mdm implementation|on boarding sources to mdm|port legacy stacks|operational matrices|aggregate data validation|generic reconciliation|improvement in wireshaping/i.test(
      low,
    )
  ) {
    return "industry_internship";
  }

  // Surname glued + leftover internship noise
  if (/informatica business solution|dr\.|mrs\.|mr\.k\.|yyappan/i.test(t) && t.length > 80) return "glued_metadata";
  if (/online student attendance system with biometric recognitiondr/i.test(low)) return "glued_metadata";
  if (/jayaswal real estate|kumari online student/i.test(low)) return "glued_metadata";

  // Truncated MGIT / fragment titles that are not usable alone
  if (
    /^(using |with |series analysis|shoppers|sales prediction analysis|scissor game|rock or mine|transcript summariser|revocation in|recognition attendance|recognition using|to homes|windows widgets|yolov4:|suppressing uncertainties|three layer privacy|time sign language|securing data with|brent |customer segmentation|photosketching|pulmonary ct|sonar rock|youtube |cnn- based|examination surveillance|picture styling|web attack detection|fake currency|black friday|password manager using|bigmart|analysis of reviews|real time sign|onlne payment|certificate revocation|face recognition attendance|secure e-voting|evaluation of printed|medical diagnosis expert|desktop notifications|an automatic garbage|photosketching)/i.test(
      t,
    ) && t.split(/\s+/).length <= 8
  ) {
    // many of these ARE ok as short titles if complete enough — only drop clearly broken fragments
  }
  if (/^(using |with |to homes|series analysis|shoppers|scissor game|transcript summariser|revocation in|recognition attendance|recognition using|windows widgets|brent |photosketching|pulmonary ct|sonar rock|youtube |cnn- based|picture styling|onlne payment|certificate revocation|time sign language|sales prediction analysis|rock or mine prediction)/i.test(low)) {
    return "truncated_fragment";
  }
  if (/^yolov4:/i.test(low)) return "paper_title_not_project";
  if (/suppressing uncertainties with large-scale/i.test(low)) return "paper_title_not_project";

  // NIT ECE titles that still include trailing student name lists / incomplete
  if (/,\s*[A-Z]\.?$/.test(t) || /\b[A-Z]\.\s*$/.test(t)) return "trailing_initials";
  if (/\b(karthi m\.s|thangadurai|visshnu|arvindhan|suyambu|ramesh krishnan|vipin lal|sarath s|nitin r|harinivash|raj kamal|sibinanth|sangeetha m|agni lokayatha|kilari|banu prasad|naga shiva|jayanth|anirudha s|sreevatsan|damarla|kethavath|arutselvan|aswin gururaj|naven s r|mylavan|narottaman|deepanshu|ganesh kumar agrawal|sharan rajamanoharan|deepak kumar, preity|sidharth sajan|sai sanika|kavin r|hirthickkesh|ananya khera|sammeta|amal s pradeep|gondala|aniket tiwari|hemanaathan|lok visnu)\b/i.test(t)) {
    return "student_names_in_title";
  }

  // Advanced-only / not OD-feasible without special labs (keep Amrita as inspiration unless clearly impossible)
  if (/quantum.?secure|post-quantum vpn|hybrid post-quantum|data diodes for cyber physical|moving target defense model for securing hospital|deterministic execution replay and os-agnostic memory carving/i.test(low)) {
    return "too_advanced_special_lab";
  }

  // Pure finance stock apps with no eng angle — weak for OD/BEng hardware/systems FYP but COE can do ML; keep ML stock if clear. Drop sector-wise recommendation fluff only if citation-like already handled.

  // AISSMS duplicates / near-junk short labels
  if (/^voice tone recommendation$/i.test(t)) return "too_vague";
  if (/^environment behavior prediction$/i.test(t)) return "too_vague";
  if (/^pap yres|^papyres/i.test(low)) return "too_narrow_admin";
  if (/navigation system for aissms/i.test(low)) return "campus_specific_india";
  if (/maharashtra tourism/i.test(low)) return "india_specific";
  if (/yellow pages:a telephone directory/i.test(low)) return "outdated_toy";
  if (/matrimonial website/i.test(low)) return "not_eng_fyp";
  if (/make a list$/i.test(low)) return "toy";
  if (/^mobile application$/i.test(low)) return "too_vague";
  if (/^one \(user management$/i.test(low)) return "broken";
  if (/platform for increasing empl/i.test(low)) return "truncated_fragment";

  // Surname-glued MCA leftovers (First token looks like Indian surname + rest may be ok — drop if starts with known surname glue from bad parse and seed is nitt-mca)
  if (seed.includes("nitt-mca")) {
    if (
      /^(Agarawal|Agrawal|Arora|Bairwa|Bano|Baskey|Beck|Beniwal|Bhatti|Bhosle|Bohra|Borkute|Bundele|Choudhari|Choudhary|Chouhan|Dangi|Dhankar|Dixit|Gupta|Jain|Jaiswal|Jayaswal|Joshi|Karmali|Khaparde|Kirange|Kothari|Kumar|Kumari|Lalwani|lariya|Maheshwari|Malviya|Maran|Matta|Monekho|Nagliya|namdev|Pathania|Patidar|Prajapati|Prakash|Pramod|Pratap|Raghuwanshi|Sahu|Seth|Shah|Shankar|Sharma|Sheeba|Shrivastava|Singh|Singoriya|Soni|Thakur|Tiwari|Vani|Vats|Verma|Yadav|zoho)\b/i.test(
        t,
      )
    ) {
      return "surname_glued";
    }
  }

  return null;
}

const drop = [];
const keep = [];
for (const row of data) {
  const why = reason(row);
  if (why) drop.push({ ...row, why });
  else keep.push(row);
}

const byWhy = {};
for (const r of drop) {
  byWhy[r.why] = (byWhy[r.why] || 0) + 1;
}

console.log("ACTIVE", data.length);
console.log("DROP", drop.length, byWhy);
console.log("KEEP", keep.length);

fs.writeFileSync(
  "data/titles-import/_filter-od-beng-report.json",
  JSON.stringify({ dropped: drop, kept: keep.map((r) => ({ id: r.id, title: r.title, batch: r.batch })) }, null, 2),
);

if (!drop.length) {
  console.log("Nothing to drop");
  process.exit(0);
}

const ids = drop.map((r) => r.id);
const chunk = 80;
let n = 0;
for (let i = 0; i < ids.length; i += chunk) {
  const part = ids.slice(i, i + chunk);
  const { error: upErr } = await db
    .from("title_proposals")
    .update({ status: "dropped", updated_at: new Date().toISOString() })
    .in("id", part);
  if (upErr) throw new Error(upErr.message);
  n += part.length;
  console.log(`Dropped ${n} / ${ids.length}`);
}

const left = await db
  .from("title_proposals")
  .select("id, title, batch", { count: "exact" })
  .like("seed_key", "pub-%")
  .neq("status", "dropped");
console.log("REMAINING", left.count);
const byBatch = {};
for (const r of left.data ?? []) {
  byBatch[r.batch || "?"] = (byBatch[r.batch || "?"] || 0) + 1;
}
console.log("BY_BATCH", byBatch);
console.log("SAMPLE_KEEP", (left.data ?? []).slice(0, 25).map((r) => r.title));
