/**
 * Rewrite Kaggle catalogue titles to plain TZ-style FYP wording.
 *
 *   node scripts/rewrite-kaggle-titles.mjs
 *   node scripts/rewrite-kaggle-titles.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const dry = process.argv.includes("--dry-run");

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const byOldPath = path.join(process.cwd(), "data", "titles-import", "kaggle-title-rewrites-by-old.json");
const byOld = JSON.parse(fs.readFileSync(byOldPath, "utf8"));

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: rows, error } = await db
  .from("title_proposals")
  .select("id, title, seed_key")
  .neq("status", "dropped")
  .like("seed_key", "kaggle-%");

if (error) {
  console.error(error);
  process.exit(1);
}

const rewrites = {};
let missingMap = 0;
const now = new Date().toISOString();

for (const row of rows ?? []) {
  const next = byOld[row.title];
  if (!next) {
    console.warn("no rewrite for:", row.title);
    missingMap += 1;
    continue;
  }
  rewrites[row.id] = next;
  if (row.title === next) continue;
  console.log(`\n${row.seed_key}\n  was: ${row.title}\n  now: ${next}`);
  if (!dry) {
    const { error: upErr } = await db.from("title_proposals").update({ title: next, updated_at: now }).eq("id", row.id);
    if (upErr) console.error(upErr.message, row.id);
  }
}

const outPath = path.join(process.cwd(), "data", "titles-import", "kaggle-title-rewrites.json");
fs.writeFileSync(outPath, JSON.stringify({ note: "Kaggle titles by id", rewrites }, null, 2));

console.log(
  `\nRows: ${rows?.length ?? 0}, mapped: ${Object.keys(rewrites).length}, missing map: ${missingMap}, dry=${dry}`,
);
if (missingMap) process.exit(1);