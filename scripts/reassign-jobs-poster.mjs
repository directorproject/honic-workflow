// Reassign recent demo jobs from inova to Hosea Kimaro and Denis Sawe.
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
        "User-Agent": "honic-reassign-jobs",
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : null;
  }

  async function ensureAccount(userId) {
    const existing = await query(
      `select public_id from public.portal_accounts where user_id = '${userId}'::uuid limit 1`,
    );
    if (existing?.[0]?.public_id) return String(existing[0].public_id);
    const publicId = newPublicId();
    await query(`
      insert into public.portal_accounts (user_id, public_id)
      values ('${userId}'::uuid, '${publicId}')
      on conflict (user_id) do update set updated_at = now();
    `);
    const again = await query(
      `select public_id from public.portal_accounts where user_id = '${userId}'::uuid limit 1`,
    );
    return String(again?.[0]?.public_id ?? publicId);
  }

  // Find by email / auth metadata / student_profiles.full_name.
  const users = await query(`
    select
      u.id::text as id,
      u.email,
      coalesce(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        u.raw_user_meta_data->>'display_name',
        ''
      ) as meta_name,
      coalesce(sp.full_name, '') as profile_name
    from auth.users u
    left join public.student_profiles sp on sp.user_id = u.id
    order by u.created_at asc;
  `);

  const needle = (row) =>
    `${row.email || ""} ${row.meta_name || ""} ${row.profile_name || ""}`.toLowerCase();

  const hosea = (users || []).find((u) => /hosea|kimaro/.test(needle(u)));
  const denis = (users || []).find((u) => /denis|sawe/.test(needle(u)));

  if (!hosea || !denis) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          message: "Could not resolve both users",
          hosea: hosea || null,
          denis: denis || null,
          sample: (users || []).map((u) => ({
            email: u.email,
            meta_name: u.meta_name,
            profile_name: u.profile_name,
          })),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  const hoseaPublicId = await ensureAccount(hosea.id);
  const denisPublicId = await ensureAccount(denis.id);

  const titles = [
    "Draw system block diagram for hospital IoT monitoring",
    "Draw flowchart for library book lending system",
    "Make 8-slide defense deck for smart irrigation project",
    "Sketch sensor node schematic for soil moisture IoT",
    "Write methodology section for attendance system study",
    "PCB layout sketch for wearable pulse oximeter board",
  ];

  const jobs = await query(`
    select id::text as id, public_id, title, offer_tsh, poster_user_id::text as poster_user_id
    from public.portal_jobs
    where title in (${titles.map((t) => `'${esc(t)}'`).join(",")})
      and status = 'open'
    order by created_at asc;
  `);

  if (!jobs?.length) throw new Error("No matching open jobs found.");

  const owners = [
    { user: hosea, publicId: hoseaPublicId },
    { user: denis, publicId: denisPublicId },
  ];

  const moved = [];
  for (let i = 0; i < jobs.length; i++) {
    const owner = owners[i % 2];
    const job = jobs[i];
    await query(`
      update public.portal_jobs
      set
        poster_user_id = '${owner.user.id}'::uuid,
        poster_public_id = '${owner.publicId}',
        updated_at = now()
      where id = '${job.id}'::uuid;
    `);
    moved.push({
      title: job.title,
      offer_tsh: job.offer_tsh,
      toEmail: owner.user.email,
      toName: owner.user.profile_name || owner.user.meta_name || null,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        hosea: { email: hosea.email, name: hosea.profile_name || hosea.meta_name },
        denis: { email: denis.email, name: denis.profile_name || denis.meta_name },
        moved,
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
