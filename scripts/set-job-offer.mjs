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

const jobPublicId = process.argv[2] || "b6c5da6d9f446900e83661f0c8559f78e49f5a68f48eb761e9b65c8495eaa66d";
const offer = Math.round(Number(process.argv[3] || 500));

async function main() {
  const env = { ...readEnv(".env.local"), ...readEnv(".env.tools.local"), ...process.env };
  const token = env.SUPABASE_ACCESS_TOKEN;
  const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "honic-set-job-offer",
    },
    body: JSON.stringify({
      query: `
        update public.portal_jobs
        set offer_tsh = ${offer},
            description = regexp_replace(description, 'TEST [0-9]+:', 'TEST ${offer}:'),
            updated_at = now()
        where public_id = '${jobPublicId}'
        returning public_id, offer_tsh, title, status;
      `,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 500));
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
