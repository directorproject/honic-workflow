/**
 * Restore soft-dropped OD NTA L6 titles and rename batch to a clean FYP label.
 *
 *   node scripts/restore-od-nta-l6-titles.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const NEW_BATCH = "OD NTA Level 6 · 2024/2025";

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
  .select("id, batch, communication, summary, notes, status")
  .or(
    [
      "seed_key.like.dit-dit-od-mini-%",
      "batch.ilike.DIT NTA L6 ETE & CST%",
      "batch.ilike.%Mini One%",
      "origin_ref.ilike.%OD_projects titles%",
    ].join(","),
  );

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(`Restoring ${data?.length ?? 0} OD titles → "${NEW_BATCH}"`);

let ok = 0;
for (const row of data ?? []) {
  const communication = String(row.communication ?? "Final year project titles")
    .replace(/Mini\s*project\s*titles/gi, "Final year project titles")
    .replace(/Mini\s*project/gi, "Final year project")
    .replace(/Mini\s*One/gi, "Final year");
  const summary = String(row.summary ?? "")
    .replace(/Mini\s*One/gi, "Final year")
    .replace(/Mini\s*project/gi, "final year project");
  const notes = String(row.notes ?? "")
    .replace(/Mini\s*One\s*presentation/gi, "OD final year project")
    .replace(/Mini\s*One/gi, "Final year")
    .replace(/Mini\s*project/gi, "final year project");

  const { error: upErr } = await db
    .from("title_proposals")
    .update({
      status: "available",
      batch: NEW_BATCH,
      communication,
      summary,
      notes,
      updated_at: now,
    })
    .eq("id", row.id);
  if (upErr) console.error(upErr.message);
  else ok += 1;
}

const { count: total } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .neq("status", "dropped");
const { count: od } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .eq("batch", NEW_BATCH)
  .neq("status", "dropped");

console.log(`Restored ${ok}. OD active: ${od}. Total active: ${total}`);
