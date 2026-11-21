/**
 * Ensure every DIT-sourced title_proposals row has institution = DIT (Tanzania).
 *
 *   node scripts/set-dit-titles-tanzania.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DIT = "Dar es Salaam Institute of Technology (DIT)";

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
  .select("id, institution, batch, seed_key, origin_ref")
  .neq("status", "dropped")
  .or(
    [
      "seed_key.like.dit-%",
      "seed_key.like.beng19-%",
      "batch.ilike.%DIT%",
      "batch.ilike.BENG %",
      "batch.ilike.BENG1%",
      "batch.ilike.BENG2%",
      "batch.ilike.%BENG22%",
      "batch.ilike.%BT22LS%",
      "batch.ilike.OD NTA%",
      "batch.ilike.%from BENG22%",
      "origin_ref.ilike.%DIT%",
      "origin_ref.ilike.%BENG22%",
      "origin_ref.ilike.%OD_projects%",
      "origin_ref.ilike.%BENG22ETE%",
      "origin_ref.ilike.%Assesment_Form%",
      "origin_ref.ilike.%Assessment_Form%",
      "origin_ref.ilike.%Assessmen_Form%",
    ].join(","),
  );

if (error) {
  console.error(error);
  process.exit(1);
}

const need = (data ?? []).filter((r) => String(r.institution ?? "").trim() !== DIT);
console.log(`DIT-sourced titles: ${data?.length ?? 0}; needing institution fix: ${need.length}`);

let ok = 0;
for (const row of need) {
  const { error: upErr } = await db
    .from("title_proposals")
    .update({ institution: DIT, updated_at: now })
    .eq("id", row.id);
  if (upErr) console.error(upErr.message);
  else ok += 1;
}

console.log(`Updated ${ok} → ${DIT}`);
