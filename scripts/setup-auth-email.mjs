// Sends Supabase Auth emails (confirm account, reset password, magic link, invite, email change)
// through Resend SMTP with Honic-branded templates, and raises the email rate limit.
//
//   npm run email:setup              check the Resend domain, then apply SMTP + templates
//   npm run email:setup -- --status  show the current Supabase email settings (no changes)
//
// Reads RESEND_API_KEY and EMAIL_FROM (e.g. "Honic Company Limited <portal@honiccompany.com>") from
// .env.local or .env.tools.local, and SUPABASE_ACCESS_TOKEN from .env.tools.local.

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
const origin = (env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || "https://share.honiccompany.com").replace(/\/$/, "");
const BRAND = "#0e7490";

function template({ title, intro, button, type, extra = "" }) {
  const url = `${origin}/portal/auth/callback?token_hash={{ .TokenHash }}&type=${type}`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="padding:20px 28px;border-bottom:3px solid ${BRAND}"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:14px;vertical-align:middle"><img src="${origin}/logo-nexis-mark.jpg" alt="" width="48" height="48" style="display:block;border:0;border-radius:14px"></td>
<td style="vertical-align:middle"><div style="font-size:18px;font-weight:800;line-height:1.15;color:#0f172a">Honic</div><div style="font-size:18px;font-weight:800;line-height:1.15;color:#0e7490">Nexis</div></td>
</tr></table></td></tr>
<tr><td style="padding:26px 28px 18px">
<h1 style="margin:0 0 14px;font-size:20px;color:#0f172a">${title}</h1>
<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0f172a">${intro}</p>${extra}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px"><tr><td style="border-radius:10px;background:${BRAND}"><a href="${url}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${button}</a></td></tr></table>
<p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#64748b">If the button does not work, open this link:<br><a href="${url}" style="color:${BRAND};word-break:break-all">${url}</a></p>
</td></tr>
<tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">If you did not ask for this, you can ignore this email.<br>Honic Company Limited · Innovation and Research Department · Dar es Salaam, Tanzania</td></tr>
</table></td></tr></table></body></html>`;
}

const TEMPLATES = {
  mailer_subjects_confirmation: "Confirm your Honic portal account",
  mailer_templates_confirmation_content: template({
    title: "Confirm your email",
    intro: "Welcome to Honic. Confirm your email address to finish creating your portal account for {{ .Email }}.",
    button: "Confirm my email",
    type: "signup",
  }),
  mailer_subjects_recovery: "Reset your Honic portal password",
  mailer_templates_recovery_content: template({
    title: "Reset your password",
    intro: "We received a request to reset the password for {{ .Email }}. Choose a new password with the button below.",
    button: "Choose a new password",
    type: "recovery",
  }),
  mailer_subjects_magic_link: "Your Honic portal sign-in link",
  mailer_templates_magic_link_content: template({
    title: "Sign in to the Honic portal",
    intro: "Use the button below to sign in as {{ .Email }}.",
    button: "Sign in",
    type: "email",
  }),
  mailer_subjects_invite: "You are invited to the Honic portal",
  mailer_templates_invite_content: template({
    title: "You are invited",
    intro: "Honic Company Limited invited you to the portal. Accept the invitation to set up your account.",
    button: "Accept invitation",
    type: "invite",
  }),
  mailer_subjects_email_change: "Confirm your new email for the Honic portal",
  mailer_templates_email_change_content: template({
    title: "Confirm your new email",
    intro: "Confirm that you want to change your email from {{ .Email }} to {{ .NewEmail }}.",
    button: "Confirm new email",
    type: "email_change",
  }),
};

async function api(path, init = {}) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json", "User-Agent": "honic-email-setup" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase returned ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (!ref) throw new Error("NEXT_PUBLIC_SUPABASE_URL in .env.local is not a Supabase project URL.");
  if (!env.SUPABASE_ACCESS_TOKEN) throw new Error("SUPABASE_ACCESS_TOKEN is missing from .env.tools.local.");

  const current = await api("/config/auth");
  const status = {
    smtp: current.smtp_host ? `${current.smtp_host}:${current.smtp_port} as ${current.smtp_admin_email}` : "Supabase built-in (2 emails per hour)",
    sender_name: current.smtp_sender_name ?? null,
    emails_per_hour: current.rate_limit_email_sent,
    confirmation_subject: current.mailer_subjects_confirmation,
    site_url: current.site_url,
  };
  if (process.argv.includes("--status")) {
    console.log(status);
    return;
  }

  const key = env.RESEND_API_KEY;
  const fromCandidates = [
    env.EMAIL_FROM,
    env.SMTP_SENDER_EMAIL_NOREPLY
      ? `Honic Company Limited <${env.SMTP_SENDER_EMAIL_NOREPLY}>`
      : "",
    "Honic Company Limited <noreply@mail.honiccompanystore.com>",
  ].filter(Boolean);
  if (!key) throw new Error("RESEND_API_KEY is missing (add it to .env.local).");

  const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Resend rejected the API key (${res.status}). Use a key with full access.`);
  const domains = (await res.json()).data ?? [];
  const verified = new Set(domains.filter((x) => x.status === "verified").map((x) => x.name));

  let senderName = "Honic Company Limited";
  let adminEmail = "";
  for (const from of fromCandidates) {
    const m = from.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/) ?? [null, "", from.trim()];
    const name = (m[1] || "Honic Company Limited").trim();
    const email = (m[2] || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const domain = email.split("@")[1];
    if (verified.has(domain)) {
      senderName = name;
      adminEmail = email;
      break;
    }
  }
  if (!adminEmail) {
    const listed = domains.map((x) => `${x.name} (${x.status})`).join(", ") || "(none)";
    throw new Error(
      `No Resend-verified sender domain. Set EMAIL_FROM to an address on a verified domain. Domains: ${listed}`,
    );
  }

  await api("/config/auth", {
    method: "PATCH",
    body: JSON.stringify({
      smtp_admin_email: adminEmail,
      smtp_sender_name: senderName,
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: key,
      smtp_max_frequency: 30,
      rate_limit_email_sent: 100,
      ...TEMPLATES,
    }),
  });
  const after = await api("/config/auth");
  console.log(`Done. Auth emails now come from ${senderName} <${adminEmail}> via Resend, up to ${after.rate_limit_email_sent} per hour.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
