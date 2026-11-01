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
<td style="padding-right:14px"><img src="${origin}/logo.jpg" alt="Honic" width="56" style="display:block;border:0;height:auto"></td>
<td><div style="font-size:16px;font-weight:700;color:#0f172a">Honic Company Limited</div><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#475569">Innovation and Research</div></td>
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
  mailer_subjects_confirmation: "Confirm your Honic student portal account",
  mailer_templates_confirmation_content: template({
    title: "Confirm your email",
    intro: "Welcome to the Honic student portal. Confirm your email address to finish creating your account for {{ .Email }}.",
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
  mailer_subjects_invite: "You are invited to the Honic student portal",
  mailer_templates_invite_content: template({
    title: "You are invited",
    intro: "Honic Company Limited invited you to the student portal. Accept the invitation to set up your account.",
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
  const from = env.EMAIL_FROM ?? "";
  const m = from.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/) ?? [null, "", from.trim()];
  const senderName = (m[1] || "Honic Company Limited").trim();
  const adminEmail = (m[2] || "").trim();
  if (!key) throw new Error("RESEND_API_KEY is missing (add it to .env.local).");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error('EMAIL_FROM must look like "Honic Company Limited <portal@honiccompany.com>".');

  const domain = adminEmail.split("@")[1];
  const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Resend rejected the API key (${res.status}). Use a key with full access.`);
  const domains = (await res.json()).data ?? [];
  const d = domains.find((x) => x.name === domain);
  if (!d) throw new Error(`Add ${domain} in Resend (Domains) first.`);
  if (d.status !== "verified") throw new Error(`${domain} is "${d.status}" in Resend. Add the DNS records Resend shows, wait for "verified", then run this again.`);

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
