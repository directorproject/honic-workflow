// Seed one open demo job (+ sample applications) so Apply UI can be tried.
import { randomBytes } from "node:crypto";
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

function newPublicId() {
  return randomBytes(32).toString("hex");
}

async function main() {
  const env = { ...readEnv(".env.local"), ...readEnv(".env.tools.local"), ...process.env };
  const token = env.SUPABASE_ACCESS_TOKEN;
  const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing.");
  if (!ref) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing.");

  async function query(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "honic-seed-demo-job",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
  }

  async function accountPublicId(userId) {
    const existing = await query(
      `select public_id from public.portal_accounts where user_id = '${userId}'::uuid limit 1`,
    );
    if (existing?.[0]?.public_id) return String(existing[0].public_id);
    const publicId = newPublicId();
    await query(`
      insert into public.portal_accounts (user_id, public_id)
      values ('${userId}'::uuid, '${publicId}')
      on conflict (user_id) do update set updated_at = now()
      returning public_id;
    `);
    const again = await query(
      `select public_id from public.portal_accounts where user_id = '${userId}'::uuid limit 1`,
    );
    return String(again?.[0]?.public_id ?? publicId);
  }

  const users = await query(`select id::text as id, email from auth.users order by created_at asc limit 8`);
  if (!users?.length) throw new Error("No auth users found to own the demo job.");

  const poster = users[0];
  const helpers = users.slice(1, 3);
  const jobPublicId = newPublicId();
  const posterPublicId = await accountPublicId(poster.id);

  await query(`
    insert into public.portal_jobs (
      public_id, poster_user_id, poster_public_id, category, title, description,
      offer_tsh, price_mode, status, updated_at
    ) values (
      '${jobPublicId}',
      '${poster.id}'::uuid,
      '${posterPublicId}',
      'block_diagram',
      'Draw system block diagram for hospital IoT monitoring',
      'Need a clear block diagram for a final-year project: sensors at ward level, gateway, cloud dashboard, and alert path to nurses. Prefer draw.io or Visio export as PDF + editable source. Include legend and short notes on each block. Deadline: 5 days.',
      35000,
      'negotiable',
      'open',
      now()
    );
  `);

  const jobRows = await query(`select id::text as id from public.portal_jobs where public_id = '${jobPublicId}' limit 1`);
  const jobId = jobRows?.[0]?.id;
  if (!jobId) throw new Error("Demo job insert failed.");

  const apps = [];
  for (const [i, helper] of helpers.entries()) {
    const appPublicId = newPublicId();
    const helperPublicId = await accountPublicId(helper.id);
    const msg =
      i === 0
        ? "I can deliver a clean Visio + PDF block diagram in 3 days. I have done similar IoT diagrams before."
        : "Happy to draw this in draw.io with editable source. Can revise once after feedback.";
    const proposed = i === 0 ? 30000 : 32000;
    await query(`
      insert into public.portal_job_applications (
        public_id, job_id, applicant_user_id, applicant_public_id, message, proposed_tsh, status, updated_at
      ) values (
        '${appPublicId}',
        '${jobId}'::uuid,
        '${helper.id}'::uuid,
        '${helperPublicId}',
        '${msg.replaceAll("'", "''")}',
        ${proposed},
        'pending',
        now()
      );
    `);
    apps.push({ appPublicId, helperEmail: helper.email, proposed });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        jobPublicId,
        url: `/portal/jobs/${jobPublicId}`,
        posterEmail: poster.email,
        note: "Sign in as a different user than the poster to see Apply. Poster can open the job to see applications.",
        applications: apps,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
