/**
 * Backfill summary / notes / origin_ref for older pub-* title_proposals that
 * still show "No problem statement…" in the portal.
 * Also drops garbled NIT MCA rows that stored the whole PDF line as the title.
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

function clean(s, max = 1800) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function topicPhrase(title) {
  const t = clean(title, 200);
  const lower = t.charAt(0).toLowerCase() + t.slice(1);
  return /^(a|an|the)\s/i.test(lower) ? lower : `a project on ${lower}`;
}

function originFor(row) {
  const ref = typeof row.origin_ref === "string" ? row.origin_ref.trim() : "";
  if (/^https?:\/\//i.test(ref) && !ref.includes("…")) return ref;
  const batch = String(row.batch ?? "").toLowerCase();
  const seed = String(row.seed_key ?? "").toLowerCase();
  if (seed.includes("acm") || batch.includes("acm")) return "https://acmatuab.org/ideas/";
  if (seed.includes("amrita") || batch.includes("amrita")) return "https://github.com/amrita-tifac-cys-btech/2022-26";
  if (seed.includes("biet") || batch.includes("biet")) {
    return "https://biet.ac.in/pdfs/projecttitles/IV%20CSE-A%20PROJECT%20TITLES.pdf";
  }
  if (seed.includes("aissms") || batch.includes("aissms")) {
    return "https://aissmscoe.com/electronics-engineering/academics/students-projects/";
  }
  if (seed.includes("mgit") || batch.includes("mgit")) return "https://mgit.ac.in/";
  if (seed.includes("nitt") || batch.includes("nit")) return "https://www.nitt.edu/";
  return "https://www.nitt.edu/";
}

function briefFor(row) {
  const title = clean(row.title, 280);
  const institution = row.institution ? ` (${row.institution})` : "";
  const approach = originFor(row);
  const summary = clean(
    `Public title lists${institution} published this topic without a full report. Use it as inspiration: study the gap around ${topicPhrase(title)}, then write a problem statement that fits your department and setting.`,
  );
  const objectives = `Design, implement, and evaluate ${topicPhrase(title)}, adapted to your course requirements.`;
  const notes = [
    "## Main objective",
    objectives,
    "",
    "## Specific objectives",
    "1. Use the linked public title list or institute page as a starting point, then search journals and open reports for related literature.",
    "2. Write a clear problem statement and requirements suited to your course and local context.",
    "3. Design and build a working prototype, then test it against the requirements.",
    "4. Document results, limits, and recommendations for future work.",
    "",
    "## Literature and source",
    `Source / approach link: ${approach}`,
    "The public source is a title list only. Treat the link as where the title was published; build your own literature review from papers and open materials on the same theme.",
  ].join("\n");
  return { summary, notes, origin_ref: approach, updated_at: new Date().toISOString() };
}

const { data: empty, error } = await db
  .from("title_proposals")
  .select("id, title, batch, institution, origin_ref, seed_key, summary, notes")
  .like("seed_key", "pub-%")
  .neq("status", "dropped")
  .is("summary", null);
if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log("EMPTY_TO_ENRICH", empty?.length ?? 0);
let updated = 0;
for (const row of empty ?? []) {
  const patch = briefFor(row);
  const { error: upErr } = await db.from("title_proposals").update(patch).eq("id", row.id);
  if (upErr) {
    console.error("Update failed", row.id, upErr.message);
    process.exit(1);
  }
  updated += 1;
}
console.log("ENRICHED", updated);

// Drop garbled full PDF-line titles from the broken NIT MCA import
const { data: garb, error: dynErr } = await db
  .from("title_proposals")
  .select("id, title")
  .like("seed_key", "pub-nitt-mca-%")
  .neq("status", "dropped");
if (dynErr) {
  console.error(dynErr.message);
  process.exit(1);
}
const junk = (garb ?? []).filter((row) => /^\d+\s+20\d{2}\s+\d+/.test(String(row.title ?? "")));
console.log("JUNK_FULL_LINE", junk.length);
if (junk.length) {
  const { error: dropErr } = await db
    .from("title_proposals")
    .update({ status: "dropped", updated_at: new Date().toISOString() })
    .in(
      "id",
      junk.map((r) => r.id),
    );
  if (dropErr) {
    console.error(dropErr.message);
    process.exit(1);
  }
  console.log("DROPPED_JUNK", junk.length);
}

const still = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .like("seed_key", "pub-%")
  .neq("status", "dropped")
  .is("summary", null);
const filled = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .like("seed_key", "pub-%")
  .neq("status", "dropped")
  .not("summary", "is", null);
console.log("REMAINING_EMPTY", still.count, "FILLED_ACTIVE", filled.count);

const sample = await db
  .from("title_proposals")
  .select("title, summary, origin_ref")
  .or("title.eq.Rathore Set top box integration,title.eq.Kolte Continuous Integration for Mammography Software,title.eq.Continuous Integration for Mammography Software,title.eq.Set top box integration")
  .neq("status", "dropped");
console.log("SAMPLE", JSON.stringify(sample.data, null, 2));
