// Grant an active Nexis Desk paid plan to a user matched by email/name (default: honic / inova).
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
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing.");
  if (!ref) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing.");

  const needle = String(process.argv[2] || "honic").toLowerCase();
  const plan = String(process.argv[3] || "year"); // monthly | semester | year
  if (!["monthly", "semester", "year"].includes(plan)) {
    throw new Error("Plan must be monthly, semester, or year.");
  }

  async function query(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "honic-grant-desk-plan",
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
      coalesce(sp.full_name, u.raw_user_meta_data->>'full_name', '') as name,
      sp.desk_plan,
      sp.desk_expires_at
    from auth.users u
    left join public.student_profiles sp on sp.user_id = u.id
    order by u.created_at asc;
  `);

  const matches = (users || []).filter((u) => {
    const hay = `${u.email || ""} ${u.name || ""}`.toLowerCase();
    return hay.includes(needle);
  });

  if (!matches.length) {
    console.log(JSON.stringify({ ok: false, message: `No user matching "${needle}"`, sample: (users || []).slice(0, 20) }, null, 2));
    process.exit(1);
  }

  // Prefer exact-ish: email starts with needle, else first match. Skip pure staff-only if multiple.
  const target =
    matches.find((u) => String(u.email || "").toLowerCase().startsWith(needle)) ||
    matches.find((u) => /honic|inova/.test(String(u.email || "").toLowerCase())) ||
    matches[0];

  const days = plan === "year" ? 365 : plan === "semester" ? 183 : 31;
  const expires = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
  const displayName = String(target.name || "").trim() || String(target.email || "Honic").split("@")[0];

  const existing = await query(
    `select user_id::text as user_id from public.student_profiles where user_id = '${target.id}'::uuid limit 1`,
  );

  const updated = existing?.[0]
    ? await query(`
        update public.student_profiles
        set desk_plan = '${plan}',
            desk_expires_at = '${expires}'::timestamptz,
            updated_at = now()
        where user_id = '${target.id}'::uuid
        returning user_id::text as user_id, desk_plan, desk_expires_at, full_name;
      `)
    : await query(`
        insert into public.student_profiles (
          user_id, full_name, institution, course_code, year_of_study, academic_year,
          phone, reg_no, desk_plan, desk_expires_at, updated_at
        )
        values (
          '${target.id}'::uuid,
          '${displayName.replaceAll("'", "''")}',
          'Honic Company',
          coalesce((select code from public.courses order by code limit 1), 'ETE'),
          'Year 1',
          to_char(now(), 'YYYY'),
          '0700000000',
          'HONIC-' || substr(replace('${target.id}'::text, '-', ''), 1, 10),
          '${plan}',
          '${expires}'::timestamptz,
          now()
        )
        returning user_id::text as user_id, desk_plan, desk_expires_at, full_name;
      `);

  console.log(
    JSON.stringify(
      {
        ok: true,
        matched: matches.map((m) => ({ email: m.email, name: m.name, before: { desk_plan: m.desk_plan, desk_expires_at: m.desk_expires_at } })),
        granted: updated?.[0] || null,
        email: target.email,
        name: target.name,
        plan,
        desk_expires_at: expires,
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
