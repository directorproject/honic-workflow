/**
 * Fill missing problem / main / specific objectives with DIT-style temporary briefs.
 * Skips rows already enriched from PDF. Re-runnable.
 *
 *   node --env-file=.env.local scripts/fill-temporary-title-briefs.mjs
 *   node --env-file=.env.local scripts/fill-temporary-title-briefs.mjs --force
 *   node --env-file=.env.local scripts/fill-temporary-title-briefs.mjs --limit=50
 */
import { createClient } from "@supabase/supabase-js";

const force = process.argv.includes("--force");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function isPdfEnriched(notes) {
  return /##\s*Enriched from PDF\b/i.test(String(notes ?? ""));
}
function isTemporary(notes) {
  return /##\s*Temporary brief\b/i.test(String(notes ?? ""));
}
function hasSection(notes, heading) {
  const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const body = String(notes ?? "").match(re)?.[1]?.trim() ?? "";
  return body.length >= 20;
}
function hasCore(notes) {
  return (
    hasSection(notes, "Problem statement") &&
    hasSection(notes, "Main objective") &&
    hasSection(notes, "Specific objectives")
  );
}
function literatureSection(existingNotes) {
  const match = String(existingNotes ?? "").match(/##\s*Literature and source\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  const body = match?.[1]?.trim();
  return body ? `## Literature and source\n${body}` : null;
}
function buildBrief(title, summary, existingNotes) {
  const fullTitle = String(title ?? "").replace(/\s+/g, " ").trim() || "this project";
  const topic =
    fullTitle
      .replace(/^(design(?:ing)?|development|implementation|construction|building)\s+(of\s+|an\s+|a\s+)?/i, "")
      .replace(/^(an|a|the)\s+/i, "")
      .trim() || fullTitle;
  const s = String(summary ?? "").trim();
  const problem = [
    s && s.length > 40 && !/starting title|read the attached|use this as/i.test(s) ? s : null,
    `In practice, work related to ${topic} is still done with limited monitoring, slow manual steps, or tools that do not fit local campus and community conditions.`,
    `Operators and users therefore face delays, weak records, and avoidable mistakes when they need timely and reliable information.`,
    `This project proposes ${fullTitle} so the same task can be handled with a clearer process, better feedback, and a prototype that can be tested in a Tanzanian institute or community setting.`,
  ]
    .filter(Boolean)
    .join(" ");
  const main = `To design, implement, and evaluate ${fullTitle} that addresses the gaps identified in the problem statement and can be demonstrated as a working prototype.`;
  const specific = [
    `1. Review related systems and prior student projects on ${topic}, and summarise the requirements for a local use case.`,
    `2. Specify sensors, control logic, interfaces, and power or network needs for the proposed solution.`,
    `3. Build and integrate a prototype that realises the main functions of ${topic}.`,
    `4. Test the prototype against the stated requirements, record results, and note limits.`,
    `5. Document findings, recommendations, and possible improvements for future work.`,
  ].join("\n");
  const parts = [
    "## Temporary brief",
    "Starter text for literature review. Replace this when a source PDF is uploaded.",
    "",
    "## Problem statement",
    problem,
    "",
    "## Main objective",
    main,
    "",
    "## Specific objectives",
    specific,
  ];
  const lit = literatureSection(existingNotes);
  if (lit) parts.push("", lit);
  return parts.join("\n");
}

function needsFill(notes) {
  if (isPdfEnriched(notes)) return false;
  if (!force && isTemporary(notes) && hasCore(notes)) return false;
  if (!force && hasCore(notes)) return false;
  return true;
}

async function loadAll(table, selectCols) {
  const all = [];
  let from = 0;
  const page = 200;
  for (;;) {
    let query = db.from(table).select(selectCols).order("id").range(from, from + page - 1);
    if (table === "title_proposals") query = query.neq("status", "dropped");
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = data ?? [];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < page) break;
    from += page;
  }
  return all;
}

async function fillTable(table, selectCols) {
  const rows = await loadAll(table, selectCols);
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (limit && updated >= limit) break;
    if (!needsFill(row.notes)) {
      skipped++;
      continue;
    }
    const notes = buildBrief(row.title, row.summary ?? null, row.notes);
    const patch = { notes, updated_at: new Date().toISOString() };
    if (table === "title_proposals") {
      const problem = notes.match(/##\s*Problem statement\s*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1]?.trim();
      if (problem) patch.summary = problem.slice(0, 1600);
    }
    const { error: upErr } = await db.from(table).update(patch).eq("id", row.id);
    if (upErr) throw new Error(`${table} update ${row.id}: ${upErr.message}`);
    updated++;
    if (updated % 50 === 0) console.log(`${table}: updated ${updated}…`);
  }
  return { updated, skipped, total: rows.length };
}

const proposals = await fillTable("title_proposals", "id, title, summary, notes, status");
console.log("title_proposals", proposals);

const earlier = await fillTable("last_year_projects", "id, title, notes");
console.log("last_year_projects", earlier);

console.log("Done.");
