import { escapeHtml } from "@/lib/email";

const BRAND = "#0e7490";

function origin(): string {
  return (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "https://share.honiccompany.com").replace(/\/$/, "");
}

/**
 * Honic-branded transactional email (table layout and inline styles so it renders in Gmail and Outlook).
 * Paragraphs are plain text; newlines become line breaks.
 */
export function brandedEmail(params: {
  greeting?: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  footnote?: string;
}): { html: string; text: string } {
  const paras = params.paragraphs
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0f172a">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = params.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px"><tr><td style="border-radius:10px;background:${BRAND}"><a href="${escapeHtml(params.button.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(params.button.label)}</a></td></tr></table><p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#64748b">If the button does not work, open this link:<br><a href="${escapeHtml(params.button.url)}" style="color:${BRAND};word-break:break-all">${escapeHtml(params.button.url)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="padding:20px 28px;border-bottom:3px solid ${BRAND}"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:14px;vertical-align:middle"><img src="${origin()}/logo-nexis-mark.jpg" alt="" width="48" height="48" style="display:block;border:0;border-radius:14px"></td>
<td style="vertical-align:middle"><div style="font-size:18px;font-weight:800;line-height:1.15;color:#0f172a">Honic</div><div style="font-size:18px;font-weight:800;line-height:1.15;color:#0e7490">Nexis</div></td>
</tr></table></td></tr>
<tr><td style="padding:26px 28px 18px">${params.greeting ? `<p style="margin:0 0 14px;font-size:15px;color:#0f172a">${escapeHtml(params.greeting)}</p>` : ""}${paras}${button}</td></tr>
<tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">${params.footnote ? `${escapeHtml(params.footnote)}<br>` : ""}Honic Company Limited · Innovation and Research Department · Dar es Salaam, Tanzania</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    params.greeting,
    ...params.paragraphs,
    params.button ? `${params.button.label}: ${params.button.url}` : "",
    params.footnote,
    "Honic Company Limited · Innovation and Research Department",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}
