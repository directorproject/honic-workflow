/**
 * Mobile overflow audit for share.honiccompany.com (390px).
 * Usage:
 *   npm install --no-save playwright@1.49.1
 *   npx playwright install chromium
 *   node scripts/mobile-share-audit.mjs
 */
import { chromium, devices } from "playwright";

const BASE = process.env.SHARE_ORIGIN || "https://share.honiccompany.com";

const PATHS = [
  "/",
  "/portal",
  "/portal?auth=signin",
  "/portal?auth=signup",
  "/portal?auth=forgot",
  "/portal/packs",
  "/portal/titles",
  "/portal/titles?view=policy",
  "/portal/titles/mine",
  "/portal/jobs",
  "/portal/jobs/mine",
  "/portal/zimamoto",
  "/portal/home",
  "/portal/home?tab=home",
  "/portal/home?tab=gantt",
  "/portal/home?tab=calendar",
  "/portal/home?tab=field",
  "/portal/home?tab=review",
  "/portal/home?tab=files",
  "/portal/home?tab=team",
  "/portal/home?tab=messages",
  "/portal/home?tab=payments",
  "/portal/home?tab=projects",
  "/portal/home?tab=title",
  "/portal/home?tab=account",
  "/portal/home?tab=tasks",
  "/portal/home?tab=logbook",
  "/portal/home?tab=data",
  "/portal/home?tab=references",
  "/portal/reset",
  "/about",
  "/share-portal",
  "/supervisor",
  "/supervisor?auth=signin",
];

async function overflowMetrics(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const sw = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    const cw = doc.clientWidth;
    const els = [];
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.right > cw + 2 && r.width > 0) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string" ? `.${el.className.split(/\s+/).slice(0, 2).join(".")}` : "";
        els.push({ tag, id, cls, right: Math.round(r.right), cw });
        if (els.length >= 5) break;
      }
    }
    return { scrollWidth: sw, clientWidth: cw, overflow: sw > cw + 2, offenders: els, url: location.href };
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();

const results = [];
for (const path of PATHS) {
  const url = `${BASE}${path}`;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(400);
    const m = await overflowMetrics(page);
    results.push({ path, finalUrl: m.url, ...m });
    const mark = m.overflow ? "FAIL" : "ok";
    console.log(`${mark}\t${path}\tscroll=${m.scrollWidth} cw=${m.clientWidth}`);
    if (m.overflow && m.offenders.length) {
      for (const o of m.offenders) console.log(`      → ${o.tag}${o.id}${o.cls} right=${o.right}`);
    }
  } catch (err) {
    console.log(`ERR\t${path}\t${err instanceof Error ? err.message : err}`);
    results.push({ path, error: String(err) });
  }
}

const failed = results.filter((r) => r.overflow);
console.log("\n---");
console.log(`Checked ${PATHS.length} paths. Horizontal overflow: ${failed.length}`);
if (failed.length) {
  console.log("Failed:");
  for (const f of failed) console.log(`  ${f.path} → ${f.finalUrl}`);
}
await browser.close();
process.exitCode = failed.length ? 1 : 0;