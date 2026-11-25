/**
 * Delete all peer-help jobs and post two open jobs at TSh 500 from Honic Company account.
 *
 *   node scripts/reset-honic-jobs.mjs
 *   node scripts/reset-honic-jobs.mjs --dry-run
 *
 * Poster: honiccompany@gmail.com by default (--email=... to override).
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_POSTER_EMAIL = "honiccompany@gmail.com";

const dry = process.argv.includes("--dry-run");
const emailArg =
  process.argv.find((a) => a.startsWith("--email="))?.split("=").slice(1).join("=") || DEFAULT_POSTER_EMAIL;

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function newPublicId() {
  return randomBytes(32).toString("hex");
}

const NEW_JOBS = [
  {
    category: "flowchart",
    title: "Draw a simple use-case diagram for Nexis peer-help posting",
    description:
      "Need a clean use-case diagram: student poster, student helper, and Honic staff. Cover post job, apply, lock payment, deliver file, and review. Export PDF plus editable draw.io file. Due in about one week.",
    offer_tsh: 500,
    price_mode: "fixed",
  },
  {
    category: "document",
    title: "Write a one-page problem statement for GSM water pump control",
    description:
      "Draft a problem statement and two objectives for a solar GSM water pump controller for rural boreholes. Plain English, editable Word or Google Doc. Include a short list of constraints (power, signal, cost).",
    offer_tsh: 500,
    price_mode: "fixed",
  },
];

async function listAuthUsers() {
  const out = [];
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...(data?.users ?? []));
    if ((data?.users?.length ?? 0) < 200) break;
    page += 1;
  }
  return out;
}

function haystack(user, profile) {
  const meta = user.user_metadata || user.raw_user_meta_data || {};
  const name = [profile?.full_name, meta.full_name, meta.name, meta.display_name].filter(Boolean).join(" ");
  return `${user.email || ""} ${name} ${profile?.institution || ""}`.toLowerCase();
}

async function resolvePoster() {
  const users = await listAuthUsers();
  const profiles = {};
  const { data: rows } = await db.from("student_profiles").select("user_id, full_name, institution");
  for (const r of rows ?? []) profiles[r.user_id] = r;

  if (emailArg) {
    const u = users.find((x) => String(x.email || "").toLowerCase() === emailArg.toLowerCase());
    if (!u) throw new Error(`No user with email ${emailArg}`);
    return { user: u, profile: profiles[u.id] ?? null };
  }

  const ranked = users.map((u) => ({ u, h: haystack(u, profiles[u.id]) }));
  let pick =
    ranked.find((r) => /honic\s*company|honic company limited/.test(r.h)) ||
    ranked.find((r) => /@honiccompany\.com$/.test(r.u.email || "")) ||
    ranked.find((r) => /\bhonic\b/.test(r.h) && /company|limited|ltd/.test(r.h));
  if (!pick) pick = ranked.find((r) => /\bhonic\b/.test(r.h));
  if (!pick) {
    console.log(
      "Could not find Honic account. Users sample:",
      ranked.slice(0, 15).map((r) => ({ email: r.u.email, hay: r.h.slice(0, 80) })),
    );
    throw new Error('Pass --email=user@domain.com for the Honic Company poster account.');
  }
  return { user: pick.u, profile: profiles[pick.u.id] ?? null };
}

async function ensurePortalAccount(userId) {
  const { data: existing } = await db.from("portal_accounts").select("public_id").eq("user_id", userId).maybeSingle();
  if (existing?.public_id) return String(existing.public_id);
  const publicId = newPublicId();
  const { error } = await db.from("portal_accounts").upsert({ user_id: userId, public_id: publicId, updated_at: new Date().toISOString() });
  if (error) throw error;
  return publicId;
}

async function main() {
  const { data: before, error: listErr } = await db.from("portal_jobs").select("id, title, status");
  if (listErr) throw listErr;
  console.log(`Existing jobs: ${before?.length ?? 0}`);

  const poster = await resolvePoster();
  console.log(`Poster: ${poster.user.email} (${poster.profile?.full_name || "no profile name"})`);

  if (!dry) {
    const { error: delErr } = await db.from("portal_jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw delErr;
    console.log("Deleted all portal_jobs (cascade clears applications, escrows, etc.).");
  } else {
    console.log("[dry-run] would delete all jobs");
  }

  const posterPublicId = await ensurePortalAccount(poster.user.id);
  const created = [];

  for (const job of NEW_JOBS) {
    const publicId = newPublicId();
    const row = {
      public_id: publicId,
      poster_user_id: poster.user.id,
      poster_public_id: posterPublicId,
      category: job.category,
      title: job.title,
      description: job.description,
      offer_tsh: job.offer_tsh,
      price_mode: job.price_mode,
      status: "open",
      updated_at: new Date().toISOString(),
    };
    if (dry) {
      created.push({ ...row, url: `/portal/jobs/${publicId}` });
      continue;
    }
    const { error } = await db.from("portal_jobs").insert(row);
    if (error) throw error;
    created.push({ title: job.title, offer_tsh: job.offer_tsh, publicId, url: `/portal/jobs/${publicId}` });
  }

  console.log(JSON.stringify({ ok: true, dry, poster: poster.user.email, created }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});