/**
 * Create default operator user for Supabase Auth (email/password).
 * Run once locally or in CI with service role key:
 *   npm run auth:ensure-operator
 *
 * Default: inova@inova.local / hapinova
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email =
  process.env.AUTH_OPERATOR_EMAIL?.trim() ||
  `${process.env.AUTH_OPERATOR_USERNAME?.trim() || "inova"}@${process.env.AUTH_OPERATOR_EMAIL_DOMAIN?.trim() || "inova.local"}`;
const password = process.env.AUTH_OPERATOR_PASSWORD?.trim() || "hapinova";

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
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
