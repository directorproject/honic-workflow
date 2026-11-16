// Enable Supabase Auth Google provider with Client ID/Secret from .env.local
// (same Management API used by email:setup — not the supabase CLI itself).
//
//   npm run email:setup is separate; this script:
//   node scripts/setup-auth-google.mjs
//   node scripts/setup-auth-google.mjs --status
//
// Reads GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET from .env.local
// and SUPABASE_ACCESS_TOKEN from .env.tools.local.

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

const env = { ...readEnv(".env.local"), ...readEnv(".env.tools.local"), ...process.env };
const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const share = (env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || "https://share.honiccompany.com").replace(/\/$/, "");

async function api(path, init = {}) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "honic-google-auth-setup",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase returned ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function summarize(cfg) {
  return {
    google_enabled: cfg.external_google_enabled,
    google_client_id: cfg.external_google_client_id || null,
    google_secret_set: Boolean(cfg.external_google_secret),
    site_url: cfg.site_url,
    uri_allow_list: cfg.uri_allow_list,
  };
}

async function main() {
  if (!ref) throw new Error("NEXT_PUBLIC_SUPABASE_URL in .env.local is not a Supabase project URL.");
  if (!env.SUPABASE_ACCESS_TOKEN) throw new Error("SUPABASE_ACCESS_TOKEN is missing from .env.tools.local.");

  const current = await api("/config/auth");
  if (process.argv.includes("--status")) {
    console.log(summarize(current));
    return;
  }

  const clientId = (env.GOOGLE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.local first.");
  }
  if (!clientId.endsWith(".apps.googleusercontent.com")) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID does not look like a Google OAuth web client ID.");
  }
  if (!clientSecret.startsWith("GOCSPX-")) {
    throw new Error("GOOGLE_OAUTH_CLIENT_SECRET does not look like a Google client secret.");
  }

  const existingAllow = String(current.uri_allow_list || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const needed = [
    `${share}/portal/auth/callback`,
    `${share}/**`,
    "http://localhost:3000/portal/auth/callback",
    "http://localhost:3000/**",
  ];
  const uri_allow_list = [...new Set([...existingAllow, ...needed])].join(",");

  await api("/config/auth", {
    method: "PATCH",
    body: JSON.stringify({
      external_google_enabled: true,
      external_google_client_id: clientId,
      external_google_secret: clientSecret,
      uri_allow_list,
    }),
  });

  const after = await api("/config/auth");
  console.log("Done. Supabase Google provider enabled.");
  console.log(summarize(after));
  console.log(
    "Google Cloud redirect URI must include:",
    `https://${ref}.supabase.co/auth/v1/callback`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
