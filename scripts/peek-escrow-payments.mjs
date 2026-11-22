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
  if (!token || !ref) throw new Error("Missing Supabase env");

  async function query(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "honic-peek-escrow",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 800)}`);
    return text ? JSON.parse(text) : null;
  }

  const payments = await query(`
    select reference, status, amount, network, phone, purpose, provider, created_at, expires_at, provider_txn_id
    from public.title_change_payments
    where purpose = 'job_escrow' or reference ilike 'ESC%'
    order by created_at desc
    limit 12;
  `);

  const escrows = await query(`
    select e.public_id, e.status, e.amount_tsh, e.payment_reference, e.created_at, e.updated_at,
           j.public_id as job_public_id, j.title
    from public.portal_job_escrows e
    left join public.portal_jobs j on j.id = e.job_id
    order by e.created_at desc
    limit 8;
  `);

  console.log(JSON.stringify({ payments, escrows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
