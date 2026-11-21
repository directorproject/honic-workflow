/**
 * Soft-drop the “DIT ETE/CST Approved titles” batch from title_proposals,
 * and retag OD NTA L6 rows away from “Mini” wording.
 *
 *   node scripts/drop-ete-cst-approved-titles.mjs
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

const { data: approved, error: aErr } = await db
  .from("title_proposals")
  .select("id, title, batch, seed_key")
  .or(
    "batch.eq.DIT ETE/CST Approved titles,seed_key.like.dit-dit-ete-cst-%,origin_ref.ilike.%ETE - CST Approved%",
  )
  .neq("status", "dropped");
if (aErr) {
  console.error(aErr);
  process.exit(1);
}

const ids = (approved ?? []).map((r) => r.id);
console.log(`Dropping ${ids.length} ETE/CST Approved titles…`);
if (ids.length) {
  const { error } = await db
    .from("title_proposals")
    .update({ status: "dropped", updated_at: now })
    .in("id", ids);
  if (error) {
    console.error(error);
    process.exit(1);
  }
}

const { data: odRows, error: oErr } = await db
  .from("title_proposals")
  .select("id, batch, communication, summary, notes")
  .or(
    "batch.ilike.%Mini One%,batch.ilike.%Mini project%,communication.ilike.%Mini project%",
  )
  .neq("status", "dropped");
if (oErr) {
  console.error(oErr);
  process.exit(1);
}

let retagged = 0;
for (const row of odRows ?? []) {
  const batch = String(row.batch ?? "")
    .replace(/Mini\s*One/gi, "Final Year")
    .replace(/Mini\s*project/gi, "Final year project");
  const communication = String(row.communication ?? "")
    .replace(/Mini\s*project\s*titles/gi, "Final year project titles")
    .replace(/Mini\s*project/gi, "Final year project");
  const summary = String(row.summary ?? "")
    .replace(/Mini\s*One/gi, "Final Year")
    .replace(/Mini\s*project/gi, "final year project");
  const notes = String(row.notes ?? "")
    .replace(/Mini\s*One\s*presentation/gi, "OD final year project")
    .replace(/Mini\s*One/gi, "Final Year")
    .replace(/Mini\s*project/gi, "final year project");

  if (
    batch === row.batch &&
    communication === row.communication &&
    summary === (row.summary ?? "") &&
    notes === (row.notes ?? "")
  ) {
    continue;
  }

  const { error } = await db
    .from("title_proposals")
    .update({ batch, communication, summary, notes, updated_at: now })
    .eq("id", row.id);
  if (error) {
    console.error("retag fail", row.id, error.message);
    continue;
  }
  retagged += 1;
}

const { count: total } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .neq("status", "dropped");

console.log(`Dropped approved batch: ${ids.length}`);
console.log(`Retagged Mini → Final year: ${retagged}`);
console.log(`Active titles now: ${total}`);
