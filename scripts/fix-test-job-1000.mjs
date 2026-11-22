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
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "honic-fix-job" },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text.slice(0, 800));
    return text ? JSON.parse(text) : null;
  }

  const jobId = "b6c5da6d9f446900e83661f0c8559f78e49f5a68f48eb761e9b65c8495eaa66d";
  const updated = await query(`
    update public.portal_jobs
    set offer_tsh = 1000,
        description = replace(description, 'TEST 200:', 'TEST 1000:'),
        updated_at = now()
    where public_id = '${jobId}'
    returning public_id, offer_tsh, title, status;
  `);

  const expired = await query(`
    update public.title_change_payments
    set status = 'failed'
    where status = 'pending'
      and (purpose = 'job_escrow' or reference ilike 'ESC%')
      and (expires_at is null or expires_at < now())
    returning reference, amount, status;
  `);

  console.log(JSON.stringify({ updated, expired }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
