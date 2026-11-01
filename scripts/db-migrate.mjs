// Applies pending supabase/v2/*.sql migrations to the dashboard Supabase project, in file-name order.
//
//   npm run db:migrate              apply every file not yet recorded in ops.schema_migrations
//   npm run db:migrate -- --status  list applied and pending files without changing anything
//   npm run db:migrate -- --baseline  record every file as applied without running it (existing databases)
//
// Needs SUPABASE_ACCESS_TOKEN (a personal access token, sbp_...) in .env.tools.local, and
// NEXT_PUBLIC_SUPABASE_URL in .env.local. The token must never go to .env.local or Vercel.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "v2");

function readEnv(file) {
  const path = join(root, file);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
  }
  return out;
}

async function main() {
  const env = { ...readEnv(".env.local"), ...readEnv(".env.tools.local"), ...process.env };
  const token = env.SUPABASE_ACCESS_TOKEN;
  const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is missing from .env.tools.local.");
  if (!ref) throw new Error("NEXT_PUBLIC_SUPABASE_URL in .env.local is not a Supabase project URL.");

  async function query(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "honic-db-migrate" },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase returned ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
  }

  await query(`
    create schema if not exists ops;
    revoke all on schema ops from public, anon, authenticated;
    create table if not exists ops.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );`);

  const files = readdirSync(migrationsDir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const applied = new Set((await query("select name from ops.schema_migrations")).map((r) => r.name));
  const pending = files.filter((f) => !applied.has(f));
  const args = new Set(process.argv.slice(2));
  const literal = (s) => `'${s.replaceAll("'", "''")}'`;

  if (args.has("--status")) {
    for (const f of files) console.log(`${applied.has(f) ? "applied" : "PENDING"}  ${f}`);
    return;
  }
  if (args.has("--baseline")) {
    if (pending.length) {
      await query(`insert into ops.schema_migrations (name) values ${pending.map((f) => `(${literal(f)})`).join(", ")} on conflict do nothing;`);
    }
    console.log(`Recorded ${pending.length} file(s) as applied without running them.`);
    return;
  }
  if (!pending.length) {
    console.log(`Database ${ref} is up to date (${files.length} migrations).`);
    return;
  }
  for (const f of pending) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    await query(`${sql}\n;\ninsert into ops.schema_migrations (name) values (${literal(f)});`);
    console.log(`Applied ${f}`);
  }
  console.log(`Database ${ref} is up to date (${files.length} migrations).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
