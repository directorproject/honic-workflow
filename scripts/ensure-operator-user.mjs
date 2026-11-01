/**
 * Create (or grant staff access to) an operator user for Supabase Auth (email/password).
 * Only accounts with app_metadata.role = "staff" can sign in to the dashboard.
 * Loads .env.local / .env from project root (same as Next.js).
 *
 *   npm run auth:ensure-operator
 *   AUTH_OPERATOR_EMAIL=name@inova.local AUTH_OPERATOR_PASSWORD=... npm run auth:ensure-operator
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(join(projectRoot, ".env"));
loadEnvFile(join(projectRoot, ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email =
  process.env.AUTH_OPERATOR_EMAIL?.trim() ||
  `${process.env.AUTH_OPERATOR_USERNAME?.trim() || "inova"}@${process.env.AUTH_OPERATOR_EMAIL_DOMAIN?.trim() || "inova.local"}`;
const password = process.env.AUTH_OPERATOR_PASSWORD?.trim() || "hapinova";

if (!url || !serviceKey) {
  console.error("Missing env in .env.local (or shell):");
  if (!url) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  console.error(`Looked in: ${projectRoot}`);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureOperator() {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

  const existing = (list.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    if (existing.app_metadata?.role === "staff") return `Operator already exists with staff access: ${email}`;
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, role: "staff" },
    });
    if (error) throw new Error(`updateUserById failed: ${error.message}`);
    return `Gave staff access to existing operator: ${email}`;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: email.split("@")[0] },
    app_metadata: { role: "staff" },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  return `Created operator ${data.user?.email ?? email}`;
}

// Set exitCode instead of calling process.exit(): exiting while fetch sockets close crashes Node on Windows.
try {
  console.log(await ensureOperator());
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}