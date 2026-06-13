/**
 * Create default operator user for Supabase Auth (email/password).
 * Loads .env.local / .env from project root (same as Next.js).
 *
 *   npm run auth:ensure-operator
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

const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listErr) {
  console.error("listUsers failed:", listErr.message);
  process.exit(1);
}

const exists = (list.users ?? []).some((u) => u.email?.toLowerCase() === email.toLowerCase());
if (exists) {
  console.log(`Operator already exists: ${email}`);
  process.exit(0);
}

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { username: "inova", role: "operator" },
});

if (error) {
  console.error("createUser failed:", error.message);
  process.exit(1);
}

console.log(`Created operator ${data.user?.email ?? email}`);
