import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

async function dump(p, pages = 2) {
  const data = new Uint8Array(fs.readFileSync(p));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  console.log("\n===", p.split(/[/\\]/).pop(), "pages", doc.numPages, "===");
  for (let i = 1; i <= Math.min(pages, doc.numPages); i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    const text = c.items.map((it) => it.str).join("\n");
    console.log("--- page", i, "---");
    console.log(text.slice(0, 3500));
  }
}

await dump("C:/Users/user/Downloads/honic-project-handoff-2026-11-02/Project Titles ETE - CST Approved.pdf", 2);
await dump("C:/Users/user/Downloads/honic-project-handoff-2026-11-02/OD_projects titles 20242025 - Mini 01 S1 (2).pdf", 2);
