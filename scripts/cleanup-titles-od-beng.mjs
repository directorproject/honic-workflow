/**
 * Drop catalogue titles that:
 * - do not fit OD / BEng electronics / computer engineering style work
 * - have no usable explanation AND no real source/document link
 * - are duplicates of a better kept title
 *
 *   node scripts/cleanup-titles-od-beng.mjs
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normTitle(t) {
  return String(t ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fitsOdBeng(title, summary, hardware, communication, notes) {
  const blob = `${title} ${summary} ${hardware} ${communication} ${notes}`.toLowerCase();
  if (!title || title.length < 12) return false;

  if (
    /\b(vr museum|virtual reality museum|job market scraper|fake news|social media sentiment|dating app|matrimonial|stock trading bot|crypto trading|nft marketplace|ecommerce blog|todo app|portfolio website|text adventure|simple calculator|to-do list|blog cms|chatbot only)\b/.test(
      blob,
    )
  ) {
    return false;
  }
  if (/\b(pure finance|hedge fund|forex|cryptocurrency prediction)\b/.test(blob) && !/\biot|sensor|embed|electr/.test(blob)) {
    return false;
  }

  const keepHint =
    /\b(iot|internet of things|arduino|raspberry|esp32|esp8266|sensor|embed|robot|drone|antenna|pcb|fpga|plc|solar|grid|battery|motor|power|electr|telecommunication|telecom|wireless|rfid|nfc|bluetooth|mqtt|nodemcu|stm32|healthcare monitor|patient monitor|attendance|water|waste|farm|agricultur|irrigation|parking|traffic|security|surveillance|face recognition|biometric|fire|flood|smart home|smart city|wearable|ecg|heart rate|cyber|firewall|phishing|intrusion|password|encrypt|network|vision|opencv|yolo|image process|toll|street light|charging|gsm|gps|lora|zigbee|rf\b|electronics|microcontroller|monitoring|automation|control system|signal|communication)\b/i.test(
      blob,
    );

  return keepHint;
}

function realSourceUrl(origin) {
  const u = String(origin ?? "").trim();
  if (!/^https?:\/\//i.test(u)) return false;
  if (/kaggle\.com\/datasets\//i.test(u)) return false;
  if (/mgit\.ac\.in\/?$/i.test(u)) return false;
  return true;
}

function hasExplanation(summary, notes) {
  const s = String(summary ?? "").trim();
  const n = String(notes ?? "").trim();
  if (s.length >= 80 && !/^this title comes from/i.test(s) && !/^public title lists/i.test(s)) return true;
  if (s.length >= 120) return true;
  // Notes with a concrete abstract-like literature section still help.
  if (/source \/ approach link:\s*https?:\/\//i.test(n) && s.length >= 40) return true;
  return false;
}

function qualityScore(row) {
  let score = 0;
  if (realSourceUrl(row.origin_ref)) score += 50;
  if (/github\.com/i.test(String(row.origin_ref ?? ""))) score += 20;
  if (hasExplanation(row.summary, row.notes)) score += 30;
  score += Math.min(20, String(row.summary ?? "").length / 40);
  if (String(row.seed_key ?? "").startsWith("beng19-")) score += 40;
  return score;
}

async function fetchAll() {
  const rows = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await db
      .from("title_proposals")
      .select("id, title, summary, notes, origin_ref, hardware, communication, seed_key, status, created_at")
      .neq("status", "dropped")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < page) break;
    from += page;
  }
  return rows;
}

const rows = await fetchAll();
const dropIds = new Set();
const reasons = { unfit: 0, no_source_or_explain: 0, duplicate: 0 };

for (const row of rows) {
  if (
    !fitsOdBeng(row.title, row.summary, row.hardware, row.communication, row.notes)
  ) {
    dropIds.add(row.id);
    reasons.unfit += 1;
  }
}

for (const row of rows) {
  if (dropIds.has(row.id)) continue;
  const okExplain = hasExplanation(row.summary, row.notes);
  const okSource = realSourceUrl(row.origin_ref);
  if (!okExplain && !okSource) {
    dropIds.add(row.id);
    reasons.no_source_or_explain += 1;
  } else if (!okSource && /^this title comes from the open past fyp/i.test(String(row.summary ?? ""))) {
    // Generic kaggle filler with only dataset homepage — no project source.
    dropIds.add(row.id);
    reasons.no_source_or_explain += 1;
  } else if (!okSource && /kaggle\.com\/datasets\//i.test(String(row.origin_ref ?? ""))) {
    // Kaggle homepage is not a project document/source file.
    dropIds.add(row.id);
    reasons.no_source_or_explain += 1;
  }
}

const byTitle = new Map();
for (const row of rows) {
  if (dropIds.has(row.id)) continue;
  const key = normTitle(row.title);
  if (!key) continue;
  const prev = byTitle.get(key);
  if (!prev) {
    byTitle.set(key, row);
    continue;
  }
  const keep = qualityScore(row) >= qualityScore(prev) ? row : prev;
  const lose = keep === row ? prev : row;
  byTitle.set(key, keep);
  dropIds.add(lose.id);
  reasons.duplicate += 1;
}

const ids = [...dropIds];
console.log(`Active before=${rows.length} drop=${ids.length}`, reasons);

const chunk = 80;
let updated = 0;
const now = new Date().toISOString();
for (let i = 0; i < ids.length; i += chunk) {
  const part = ids.slice(i, i + chunk);
  const { error, count } = await db
    .from("title_proposals")
    .update({ status: "dropped", updated_at: now })
    .in("id", part)
    .select("id", { count: "exact" });
  if (error) throw new Error(error.message);
  updated += count ?? part.length;
  console.log(`Dropped ${Math.min(i + chunk, ids.length)} / ${ids.length}`);
}

const { count: left } = await db
  .from("title_proposals")
  .select("id", { count: "exact", head: true })
  .neq("status", "dropped");

console.log("DONE", { dropped: updated, still_active: left });
