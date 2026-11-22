/**
 * One-off: Snippe completed but our ESC row still pending → mark paid + fund escrow.
 *   node scripts/fulfill-stuck-escrow.mjs [ESC…]
 */
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
const lit = (s) => `'${String(s).replaceAll("'", "''")}'`;

async function main() {
  const env = { ...readEnv(".env.local"), ...readEnv(".env.tools.local"), ...process.env };
  const token = env.SUPABASE_ACCESS_TOKEN;
  const project = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const orderWanted = process.argv[2] || "ESCMWRWRVX04FA37F44";
  if (!token || !project) throw new Error("Missing Supabase env");

  async function query(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "honic-fulfill-stuck-escrow",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 800)}`);
    return text ? JSON.parse(text) : null;
  }

  const pays = await query(`
    select id, user_id, status, reference, amount, provider_txn_id
    from public.title_change_payments
    where reference = ${lit(orderWanted)}
    limit 1;
  `);
  const pay = pays?.[0];
  if (!pay) throw new Error(`Payment ${orderWanted} not found`);

  const snippeRef = String(pay.provider_txn_id || "");
  if (!snippeRef) throw new Error("No provider_txn_id");
  const key = (env.SNIPPE_API_KEY || "").trim();
  const base = (env.SNIPPE_API_URL || "https://api.snippe.sh").replace(/\/$/, "");
  const liveRes = await fetch(`${base}/v1/payments/${encodeURIComponent(snippeRef)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const live = (await liveRes.json())?.data;
  if (String(live?.status).toLowerCase() !== "completed") {
    throw new Error(`Snippe status is ${live?.status}, not completed`);
  }
  if (Math.round(Number(live?.amount?.value)) !== Math.round(Number(pay.amount))) {
    throw new Error("Amount mismatch with Snippe");
  }

  const escrows = await query(`
    select id, status, job_id
    from public.portal_job_escrows
    where payment_reference = ${lit(orderWanted)} or payment_id = ${lit(pay.id)}
    limit 1;
  `);
  const escrow = escrows?.[0];
  if (!escrow) throw new Error("Escrow not found");

  const at = new Date().toISOString();
  console.log(
    "payment",
    await query(`
      update public.title_change_payments
      set status = 'paid', paid_at = ${lit(at)}, provider_txn_id = ${lit(snippeRef)}
      where id = ${lit(pay.id)} and status in ('pending', 'failed')
      returning id, status;
    `),
  );
  console.log(
    "escrow",
    await query(`
      update public.portal_job_escrows
      set status = 'funded',
          locked_at = coalesce(locked_at, ${lit(at)}),
          payment_id = ${lit(pay.id)},
          payment_reference = ${lit(orderWanted)},
          updated_at = ${lit(at)}
      where id = ${lit(escrow.id)} and status = 'awaiting_funds'
      returning id, status;
    `),
  );
  console.log(
    "job",
    await query(`
      update public.portal_jobs
      set status = 'assigned', assigned_application_id = null, updated_at = ${lit(at)}
      where id = ${lit(escrow.job_id)} and status = 'open'
      returning id, status;
    `),
  );
  try {
    await query(`
      insert into public.portal_job_escrow_events (escrow_id, event_type, actor_role, message)
      values (
        ${lit(escrow.id)},
        'funds_held',
        'system',
        'Money locked (reconcile after missed webhook). Request marked taken.'
      );
    `);
  } catch (e) {
    console.warn("event insert skipped", e.message || e);
  }
  console.log("DONE — refresh the poster job page.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
