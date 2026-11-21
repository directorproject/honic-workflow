/**
 * Soft-drop the “DIT NTA L6 ETE & CST Mini One / Final Year 2024/2025” OD import batch.
 *
 *   node scripts/drop-od-nta-l6-mini-one.mjs
 */
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

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const now = new Date().toISOString();

const { data, error } = await db
  .from("title_proposals")
  .select("id, title, batch, seed_key")
  .or(
    [
      "batch.eq.DIT NTA L6 ETE & CST Mini One 2024/2025",
      "batch.eq.DIT NTA L6 ETE & CST Final Year 2024/2025",
      "batch.ilike.DIT NTA L6 ETE & CST%",
      "seed_key.like.dit-dit-od-mini-%",
      "origin_ref.ilike.%OD_projects titles%",
    ].join(","),
  )
  .neq("status", "dropped");

if (error) {
  console.error(error);
  process.exit(1);
}

const ids = (data ?? []).map((r) => r.id);
console.log(`Dropping ${ids.length} OD NTA L6 Mini One / Final Year titles…`);
for (const r of (data ?? []).slice(0, 5)) {
  console.log(" ·", r.batch, "|", r.title?.slice(0, 60));
}

if (ids.length) {
  const { error: upErr } = await db
    .from("title_proposals")
    .update({ status: "dropped", updated_at: now })
    .in("id", ids);
  if (upErr) {
    console.error(upErr);
    process.exit(1);
  }
}

const { count: total } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .neq("status", "dropped");

console.log(`Done. Active titles now: ${total}`);
