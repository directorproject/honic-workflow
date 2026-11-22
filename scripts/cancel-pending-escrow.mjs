/**
 * Cancel pending ESC payments + awaiting_funds escrows so the poster can lock again.
 *   node scripts/cancel-pending-escrow.mjs
 *   node scripts/cancel-pending-escrow.mjs --job <jobPublicId>
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
  if (!token || !project) throw new Error("Missing Supabase env");

  const args = process.argv.slice(2);
  const jobIdx = args.indexOf("--job");
  const jobPublicId = jobIdx >= 0 ? args[jobIdx + 1] : null;

  async function query(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "honic-cancel-pending-escrow",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 800)}`);
    return text ? JSON.parse(text) : null;
  }

  const pendingPays = await query(`
    select id, reference, status, amount, provider_txn_id, created_at, expires_at, user_id
    from public.title_change_payments
    where status = 'pending'
      and (purpose = 'job_escrow' or reference ilike 'ESC%')
    order by created_at desc;
  `);

  // Cancel awaiting + funded (held money) so poster can lock/pay again.
  // Includes odd funded+helper rows that never reached locked.
  const resetable = await query(`
    select e.id, e.public_id, e.status, e.amount_tsh, e.payment_reference, e.job_id,
           e.application_id, j.public_id as job_public_id, j.title, j.status as job_status
    from public.portal_job_escrows e
    left join public.portal_jobs j on j.id = e.job_id
    where e.status in ('awaiting_funds', 'funded')
      ${jobPublicId ? `and j.public_id = ${lit(jobPublicId)}` : ""}
    order by e.created_at desc;
  `);

  console.log(JSON.stringify({ pendingPays, resetable }, null, 2));

  if (!pendingPays?.length && !resetable?.length) {
    console.log("Nothing pending/funded-without-helper to cancel.");
    return;
  }

  const at = new Date().toISOString();

  if (pendingPays?.length) {
    const ids = pendingPays.map((p) => lit(p.id)).join(", ");
    console.log(
      "payments cancelled",
      await query(`
        update public.title_change_payments
        set status = 'failed'
        where id in (${ids}) and status = 'pending'
        returning id, reference, status;
      `),
    );
  }

  if (resetable?.length) {
    const ids = resetable.map((e) => lit(e.id)).join(", ");
    console.log(
      "escrows cancelled",
      await query(`
        update public.portal_job_escrows
        set status = 'cancelled',
            cancelled_at = ${lit(at)},
            updated_at = ${lit(at)},
            application_id = null,
            helper_user_id = null
        where id in (${ids}) and status in ('awaiting_funds', 'funded')
        returning id, payment_reference, status;
      `),
    );

    // Put accepted apps back to pending so chats stay usable after reset.
    const appIds = [...new Set(resetable.map((e) => e.application_id).filter(Boolean))];
    if (appIds.length) {
      console.log(
        "apps reopened",
        await query(`
          update public.portal_job_applications
          set status = 'pending', updated_at = ${lit(at)}
          where id in (${appIds.map(lit).join(", ")}) and status = 'accepted'
          returning id, status;
        `),
      );
    }

    const jobIds = [...new Set(resetable.map((e) => e.job_id).filter(Boolean))];
    for (const jobId of jobIds) {
      const active = await query(`
        select id, status from public.portal_job_escrows
        where job_id = ${lit(jobId)}
          and status in ('funded', 'locked', 'delivered', 'disputed', 'released')
        limit 1;
      `);
      if (active?.length) {
        console.log("job keep status — active escrow exists", jobId, active[0].status);
        continue;
      }
      console.log(
        "job reopen",
        await query(`
          update public.portal_jobs
          set status = 'open', assigned_application_id = null, updated_at = ${lit(at)}
          where id = ${lit(jobId)} and status in ('open', 'assigned')
          returning id, public_id, status;
        `),
      );
    }
  }

  console.log("DONE — poster can lock money again.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
