// Update block-diagram job to 5k and insert five open jobs (offer ≤ 10k).
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

const NEW_JOBS = [
  {
    category: "flowchart",
    title: "Draw flowchart for library book lending system",
    description:
      "Need a clear flowchart covering borrow, renew, return, and overdue fine paths. Prefer draw.io with PDF export and a short legend. Keep labels simple for a final-year report figure.",
    offer_tsh: 8000,
    price_mode: "fixed",
  },
  {
    category: "ppt",
    title: "Make 8-slide defense deck for smart irrigation project",
    description:
      "Build a clean PowerPoint: problem, objectives, system overview, method, results placeholders, and conclusion. Use readable fonts and one diagram slot. Editable .pptx preferred.",
    offer_tsh: 10000,
    price_mode: "negotiable",
  },
  {
    category: "circuit",
    title: "Sketch sensor node schematic for soil moisture IoT",
    description:
      "Draw a simple schematic: soil moisture sensor, MCU, power, and radio module. Include pin labels and a parts list note. PDF plus editable source (KiCad or fritzing-style) is fine.",
    offer_tsh: 9000,
    price_mode: "fixed",
  },
  {
    category: "document",
    title: "Write methodology section for attendance system study",
    description:
      "Draft a 1–2 page methodology for a student attendance system using RFID and a web dashboard. Cover design approach, tools, and data collection. Plain academic English, editable Word/Docs.",
    offer_tsh: 7500,
    price_mode: "negotiable",
  },
  {
    category: "layout",
    title: "PCB layout sketch for wearable pulse oximeter board",
    description:
      "Need a compact board outline with sensor, MCU, battery connector, and charging pad placement. Show approximate dimensions and keep routing notes short. Gerber not required—layout figure only.",
    offer_tsh: 10000,
    price_mode: "fixed",
  },
];

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
        "User-Agent": "honic-seed-five-jobs",
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
  if (!users?.length) throw new Error("No auth users found to own jobs.");
  const poster = users[0];
  const posterPublicId = await accountPublicId(poster.id);

  const updated = await query(`
    update public.portal_jobs
    set offer_tsh = 5000, updated_at = now()
    where title = 'Draw system block diagram for hospital IoT monitoring'
      and status = 'open'
    returning public_id, offer_tsh, title;
  `);

  const created = [];
  for (const job of NEW_JOBS) {
    const jobPublicId = newPublicId();
    await query(`
      insert into public.portal_jobs (
        public_id, poster_user_id, poster_public_id, category, title, description,
        offer_tsh, price_mode, status, updated_at
      ) values (
        '${jobPublicId}',
        '${poster.id}'::uuid,
        '${posterPublicId}',
        '${esc(job.category)}',
        '${esc(job.title)}',
        '${esc(job.description)}',
        ${job.offer_tsh},
        '${job.price_mode}',
        'open',
        now()
      );
    `);
    created.push({
      publicId: jobPublicId,
      title: job.title,
      offer_tsh: job.offer_tsh,
      url: `/portal/jobs/${jobPublicId}`,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        posterEmail: poster.email,
        blockDiagramUpdated: updated,
        created,
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
