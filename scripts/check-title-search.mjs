import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
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
const env = { ...readEnv(".env.local"), ...readEnv(".env.tools.local") };
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function normalizeTitle(value) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/[""„«»]/g, '"')
    .replace(/[''‚]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^a-zA-Z0-9\s\-./&+:'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const [{ data: proposals, error: e1, count: c1 }, { data: earlier, error: e2, count: c2 }] = await Promise.all([
  db.from("title_proposals").select("title", { count: "exact" }),
  db.from("last_year_projects").select("title", { count: "exact" }),
]);
console.log({ e1: e1?.message, e2: e2?.message, c1, c2, fetched: (proposals?.length ?? 0) + (earlier?.length ?? 0) });
const titles = [...(proposals ?? []), ...(earlier ?? [])].map((r) => String(r.title ?? ""));
const sample = titles.find((t) => t.length > 20) ?? titles[0] ?? "";
console.log("sample", JSON.stringify(sample));
console.log("norm sample", JSON.stringify(normalizeTitle(sample)));
const hits = titles.filter((t) => {
  const q = normalizeTitle(sample);
  const n = normalizeTitle(t);
  return n === q || n.includes(q) || q.includes(n);
});
console.log("exact-ish hits", hits.length);
