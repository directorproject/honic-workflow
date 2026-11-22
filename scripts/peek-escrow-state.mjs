import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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
  async function query(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "honic-peek" },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text.slice(0, 800));
    return text ? JSON.parse(text) : null;
  }

  const out = {
    escrowCount: await query(`select count(*)::int as n from public.portal_job_escrows`),
    escrows: await query(`select * from public.portal_job_escrows order by created_at desc limit 5`),
    pay: await query(`
      select id::text, reference, status, amount, purpose, provider_txn_id, created_at, expires_at, user_id::text
      from public.title_change_payments where reference = 'ESCMWR2P9SK7A454276'
    `),
    jobs200: await query(`
      select public_id, title, offer_tsh, status, poster_user_id::text, created_at
      from public.portal_jobs
      where offer_tsh in (200,500) or title ilike '%clinic%'
      order by created_at desc limit 10
    `),
    apps: await query(`
      select a.public_id, a.status, a.proposed_tsh, j.public_id as job, j.offer_tsh, j.title
      from public.portal_job_applications a
      join public.portal_jobs j on j.id = a.job_id
      order by a.created_at desc limit 10
    `),
  };
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
