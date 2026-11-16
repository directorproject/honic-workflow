import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
const BUCKET = process.env.PORTAL_FILES_BUCKET || "portal-files";
const id = process.argv[2] || "42dfc399-2153-47a2-8685-238ca59fd88e";

const { data: row } = await db.from("title_proposals").select("title,origin_ref").eq("id", id).maybeSingle();
const m = String(row?.origin_ref || "").match(/\/api\/portal\/catalogue-docs\/(.+)$/i);
const path = m[1]
  .split("/")
  .map((p) => decodeURIComponent(p))
  .join("/");
const downloaded = await db.storage.from(BUCKET).download(path);
const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
console.log("pages", doc.numPages, "title", row.title);

function textFromItems(items) {
  let out = "";
  let lastX = null;
  let lastY = null;
  for (const it of items) {
    const str = typeof it.str === "string" ? it.str : "";
    if (!str) continue;
    const x = Array.isArray(it.transform) ? Number(it.transform[4]) || 0 : 0;
    const y = Array.isArray(it.transform) ? Number(it.transform[5]) || 0 : 0;
    const w = typeof it.width === "number" ? it.width : Math.max(str.length * 4.5, 4);
    if (lastY != null && Math.abs(y - lastY) > 6) out += "\n";
    else if (lastX != null && x - lastX > Math.max(2.5, w * 0.35)) out += " ";
    out += str;
    lastX = x + w;
    lastY = y;
  }
  return out;
}

let text = "";
const start = Math.max(1, doc.numPages - 40);
for (let i = start; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  const pageText = textFromItems(content.items).replace(/\b((?:[A-Za-z] ){4,}[A-Za-z])\b/g, (s) => s.replace(/ /g, ""));
  text += `\n----- PAGE ${i} -----\n` + pageText + "\n";
}

const hits = [...text.matchAll(/ref(?:erence)?s?/gi)].slice(0, 20);
console.log(
  "ref-ish hits",
  hits.map((h) => ({ i: h.index, snip: text.slice(Math.max(0, h.index - 20), h.index + 40).replace(/\n/g, "⏎") })),
);

const idx = text.search(/REFERENCES|BIBLIOGRAPHY|LIST OF REFERENCES/i);
console.log("headingIdx", idx);
if (idx >= 0) console.log(text.slice(idx, idx + 1200));
else {
  // show last 2 pages
  console.log(text.slice(-2500));
}
