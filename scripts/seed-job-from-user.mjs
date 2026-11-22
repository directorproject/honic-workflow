// Post one open peer-help job as a named student (Denis Sawe by default).
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

function esc(s) {
  return String(s).replaceAll("'", "''");
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
        "User-Agent": "honic-seed-job-from-user",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
  }

  const users = await query(`
    select
      u.id::text as id,
      u.email,
      coalesce(sp.full_name, u.raw_user_meta_data->>'full_name', '') as name
    from auth.users u
    left join public.student_profiles sp on sp.user_id = u.id
    order by u.created_at asc;
  `);

  const denis = (users || []).find((u) => {
    const hay = `${u.email || ""} ${u.name || ""}`.toLowerCase();
    return /denis|sawe/.test(hay);
  });
  if (!denis) throw new Error("Denis Sawe user not found.");

  let account = await query(
    `select public_id from public.portal_accounts where user_id = '${denis.id}'::uuid limit 1`,
  );
  let posterPublicId = account?.[0]?.public_id ? String(account[0].public_id) : "";
  if (!posterPublicId) {
    posterPublicId = newPublicId();
    await query(`
      insert into public.portal_accounts (user_id, public_id)
      values ('${denis.id}'::uuid, '${posterPublicId}')
      on conflict (user_id) do update set updated_at = now();
    `);
    account = await query(
      `select public_id from public.portal_accounts where user_id = '${denis.id}'::uuid limit 1`,
    );
    posterPublicId = String(account?.[0]?.public_id ?? posterPublicId);
  }

  const jobPublicId = newPublicId();
  const title = "Draw use-case diagram for campus clinic booking app";
  const description =
    "Need a clean UML use-case diagram for a student clinic booking app: student, receptionist, and doctor actors; book, cancel, and view appointment cases. Prefer draw.io PDF + editable source. Include a short legend. Deadline about 4 days.";

  await query(`
    insert into public.portal_jobs (
      public_id, poster_user_id, poster_public_id, category, title, description,
      offer_tsh, price_mode, status, updated_at
    ) values (
      '${jobPublicId}',
      '${denis.id}'::uuid,
      '${posterPublicId}',
      'flowchart',
      '${esc(title)}',
      '${esc(description)}',
      5000,
      'fixed',
      'open',
      now()
    );
  `);

  console.log(
    JSON.stringify(
      {
        ok: true,
        posterEmail: denis.email,
        posterName: denis.name,
        offer_tsh: 5000,
        title,
        jobPublicId,
        url: `/portal/jobs/${jobPublicId}`,
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
