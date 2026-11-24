/**
 * Rewrite the 71 pub-import catalogue titles to plain TZ-style FYP wording.
 *
 *   node scripts/rewrite-pub-import-titles.mjs
 *   node scripts/rewrite-pub-import-titles.mjs --dry-run
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

const mapPath = path.join(process.cwd(), "data", "titles-import", "pub-import-title-rewrites.json");
const { rewrites } = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const ids = Object.keys(rewrites);
if (ids.length !== 71) {
  console.error(`Expected 71 rewrites, got ${ids.length}`);
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: rows, error } = await db
  .from("title_proposals")
  .select("id, title, seed_key")
  .in("id", ids);

if (error) {
  console.error(error);
  process.exit(1);
}

const byId = new Map((rows ?? []).map((r) => [r.id, r]));
let missing = 0;
const now = new Date().toISOString();

for (const id of ids) {
  const row = byId.get(id);
  if (!row) {
    console.warn("missing row", id);
    missing += 1;
    continue;
  }
  const next = rewrites[id];
  if (row.title === next) continue;
  console.log(`\n${row.seed_key}\n  was: ${row.title}\n  now: ${next}`);
  if (!dry) {
    const { error: upErr } = await db.from("title_proposals").update({ title: next, updated_at: now }).eq("id", id);
    if (upErr) console.error(upErr.message, id);
  }
}

console.log(`\nDone. updated ${ids.length - missing} rows (dry=${dry}, missing=${missing}).`);