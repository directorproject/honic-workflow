/**
 * Delete every non-staff Auth user (students + supervisors).
 * Keeps app_metadata.role = "staff". Releases title selections first.
 *
 *   node scripts/delete-all-non-staff-accounts.mjs
 *   CONFIRM_DELETE_ALL=YES node scripts/delete-all-non-staff-accounts.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(join(projectRoot, ".env"));
loadEnvFile(join(projectRoot, ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (process.env.CONFIRM_DELETE_ALL !== "YES") {
  console.error('Refusing to run. Set CONFIRM_DELETE_ALL=YES to delete all non-staff accounts.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function isStaff(user) {
  return user?.app_metadata?.role === "staff";
}

async function listAllUsers() {
  const users = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }
  return users;
}

async function releaseTitles(userId) {
  const now = new Date().toISOString();
  await supabase
    .from("title_proposals")
    .update({
      status: "available",
      assigned_to: null,
      assigned_at: null,
      selected_by: null,
      updated_at: now,
    })
    .eq("selected_by", userId);
  await supabase
    .from("title_selections")
    .update({ released_at: now, release_reason: "account_removed_bulk" })
    .eq("user_id", userId)
    .is("released_at", null);
}

async function main() {
  const users = await listAllUsers();
  const staff = users.filter(isStaff);
  const targets = users.filter((u) => !isStaff(u));

  console.log(`Found ${users.length} users · keep staff=${staff.length} · delete=${targets.length}`);
  for (const s of staff) {
    console.log(`  KEEP staff ${s.email ?? s.id}`);
  }

  let deleted = 0;
  let failed = 0;
  for (const user of targets) {
    try {
      await releaseTitles(user.id);
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) throw error;
      deleted += 1;
      console.log(`  DELETED ${user.email ?? user.id}`);
    } catch (err) {
      failed += 1;
      console.error(`  FAIL ${user.email ?? user.id}: ${err?.message ?? err}`);
    }
  }

  console.log(`Done. deleted=${deleted} failed=${failed} staff_kept=${staff.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
