/**
 * One-time (or re-runnable) fill of problem / objectives / Recommendations
 * from catalogue PDFs already in storage. Does not run on page load.
 * Uses Gemini when GEMINI_API_KEY is set; regex otherwise.
 *
 *   node --env-file=.env.local scripts/enrich-catalogue-briefs.mjs
 *   node --env-file=.env.local scripts/enrich-catalogue-briefs.mjs --force
 *   node --env-file=.env.local scripts/enrich-catalogue-briefs.mjs --limit=20
 */
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const force = process.argv.includes("--force");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.PORTAL_FILES_BUCKET || "portal-files";

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const pdfjs = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);

function cataloguePathFromOrigin(origin) {
  const m = String(origin ?? "").match(/\/api\/portal\/catalogue-docs\/(.+)$/i);
  if (!m?.[1]) return null;
  try {
    const path = m[1]
      .split("/")
      .map((p) => decodeURIComponent(p))
      .join("/");
    if (!path.startsWith("catalogue/") || path.includes("..") || !/\.pdf$/i.test(path)) return null;
    return path;
  } catch {
    return null;
  }
}

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

async function pdfText(bytes, headPages = 28, tailPages = 30) {
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  const total = doc.numPages;
  const pages = new Set();
  for (let i = 1; i <= Math.min(headPages, total); i++) pages.add(i);
  for (let i = Math.max(1, total - tailPages + 1); i <= total; i++) pages.add(i);
  let text = "";
  for (const i of [...pages].sort((a, b) => a - b)) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += textFromItems(content.items) + "\n\n";
  }
  // Only collapse true letter-spaced runs (P R O B L E M), keep normal words.
  return text.replace(/\b((?:[A-Za-z] ){4,}[A-Za-z])\b/g, (m) => m.replace(/ /g, ""));
}

const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim() || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
const GEMINI_FALLBACKS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest"];
let geminiQuotaExhausted = false;

function clipForModel(text, maxChars = 120000) {
  const cleaned = String(text ?? "").replace(/\u0000/g, "").trim();
  if (cleaned.length <= maxChars) return cleaned;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head - 80;
  return `${cleaned.slice(0, head)}\n\n[...middle omitted...]\n\n${cleaned.slice(-tail)}`;
}

function asNullableString(value, max = 4000) {
  if (typeof value !== "string") return null;
  const t = value.replace(/\u0000/g, "").trim();
  if (t.length < 12 || /^(null|n\/a|none|not found|missing)$/i.test(t)) return null;
  return t.slice(0, max);
}

function parseJsonObject(raw) {
  const text = String(raw ?? "").trim();
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct;
  } catch {
    /* try fence */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

async function geminiGenerate(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
      },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, text: null, error: body?.error?.message || `HTTP ${res.status}` };
  }
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return { ok: Boolean(text.trim()), text: text || null, error: null };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function extractWithGemini(rawText) {
  if (geminiQuotaExhausted) return null;
  if (!GEMINI_KEY || !rawText || rawText.trim().length < 80) return null;
  const prompt = `You extract sections from a student final-year project / dissertation PDF (plain text).
Return ONLY a JSON object with these keys (string or null). Do not invent content — copy or lightly clean wording from the document. If a section is missing, use null.

Keys:
- "problemStatement": Statement of the problem / problem statement (not abstract alone unless that is all that exists).
- "mainObjective": General / main / overall objective or aim of the study (one paragraph; not the numbered specific list).
- "specificObjectives": Specific / particular objectives (keep numbered or bulleted list when present).
- "recommendations": Prefer a Recommendations / future work chapter. If that is missing, use Scope and limitations / Project limitations / weaknesses instead.

PDF text:
---
${clipForModel(rawText)}
---`;

  // Prefer the configured model; one quick fallback if that model id is invalid.
  const models = [GEMINI_MODEL, ...GEMINI_FALLBACKS.filter((m) => m !== GEMINI_MODEL)].slice(0, 2);
  let lastError = "";
  for (const model of models) {
    try {
      const result = await geminiGenerate(model, prompt);
      if (!result.ok || !result.text) {
        lastError = result.error || "empty";
        if (/not found|NOT_FOUND|unsupported|invalid model/i.test(lastError)) continue;
        // Rate / quota: one short pause, one retry on same model, then fall back to regex.
        if (/exceeded your current quota|RESOURCE_EXHAUSTED/i.test(lastError)) {
          geminiQuotaExhausted = true;
          console.log("  gemini quota exhausted — rest of batch uses regex");
          break;
        }
        if (/quota|rate|429|high demand|503/i.test(lastError)) {
          await sleep(2500);
          const retry = await geminiGenerate(model, prompt);
          if (retry.ok && retry.text) {
            const obj = parseJsonObject(retry.text);
            if (obj) {
              return {
                problemStatement: asNullableString(obj.problemStatement, 4000),
                objectives: asNullableString(obj.mainObjective ?? obj.objectives, 2500),
                specificObjectives: asNullableString(obj.specificObjectives, 4000),
                limitations: asNullableString(obj.recommendations ?? obj.limitations, 4000),
                _model: model,
              };
            }
          }
          lastError = retry.error || lastError;
          if (/exceeded your current quota|RESOURCE_EXHAUSTED/i.test(lastError)) {
            geminiQuotaExhausted = true;
            console.log("  gemini quota exhausted — rest of batch uses regex");
          }
          break;
        }
        continue;
      }
      const obj = parseJsonObject(result.text);
      if (!obj) {
        lastError = "invalid JSON";
        continue;
      }
      return {
        problemStatement: asNullableString(obj.problemStatement, 4000),
        objectives: asNullableString(obj.mainObjective ?? obj.objectives, 2500),
        specificObjectives: asNullableString(obj.specificObjectives, 4000),
        limitations: asNullableString(obj.recommendations ?? obj.limitations, 4000),
        _model: model,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  if (lastError) console.log(`  gemini miss: ${lastError.slice(0, 120)}`);
  return null;
}

function preferLonger(a, b) {
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length * 1.05 ? b : a;
}

async function resolvePdfSections(rawText) {
  const regex = extractPdfSections(rawText);
  const ai = await extractWithGemini(rawText);
  if (!ai) return { ...regex, _ai: false };
  return {
    problemStatement: preferLonger(regex.problemStatement, ai.problemStatement),
    objectives: preferLonger(regex.objectives, ai.objectives),
    specificObjectives: preferLonger(regex.specificObjectives, ai.specificObjectives),
    limitations: preferLonger(regex.limitations, ai.limitations),
    references: preferLonger(regex.references, ai.references ?? null),
    _ai: true,
    _model: ai._model,
  };
}

// Inline extractor (keep in sync with src/lib/portal/pdf-sections.ts)
const PROBLEM_HEADINGS =
  /(?:statement\s+of\s+the\s+problem|problem\s+statement|(?:1\.\s*[23]|1\.[23])\s+(?:statement\s+of\s+the\s+)?problem(?:\s+statement)?)\b/i;
const SPECIFIC_OBJ_HEADINGS =
  /(?:specific\s+objectives?|(?:1\.\s*3\.\s*2|1\.3\.2)\s*(?:specific\s+objectives?)?|particular\s+objectives?)\b/i;
const RECOMMENDATION_HEADINGS =
  /(?:recommendations?|suggestion(?:s)?\s+for\s+(?:further|future)\s+(?:work|study|research)|future\s+work)\b/i;
const LIMIT_HEADINGS =
  /(?:limitations?\s+of\s+(?:the\s+)?(?:study|project|research)|project\s+limitations?|project\s+weakness(?:es)?|weakness(?:es)?\s+of\s+(?:the\s+)?(?:study|project)|delimitations?|scope\s+and\s+limitations?(?:\s+of\s+(?:the\s+)?project)?)\b/i;
const ABSTRACT_HEADING = /\babstract\b/i;
const NEXT_SECTION =
  /\n\s*(?:\d+(?:\.\d+){1,3}\.?\s+)(?:[A-Z][A-Za-z].{0,90}|problem|objective|limitation|recommendation|weakness|delimitation|organization|scope|significance|chapter)/i;

function clean(text, max = 4000) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, max);
}

function sliceUntilNext(text, start) {
  if (start < 0 || start >= text.length) return "";
  const rest = text.slice(start);
  const next = rest.search(NEXT_SECTION);
  const end = next > 12 ? next : Math.min(rest.length, 2200);
  return clean(rest.slice(0, end));
}

function isTocJunk(body) {
  const letters = (body.match(/[A-Za-z]/g) || []).length;
  const dotChars = (body.match(/\./g) || []).length;
  if (letters < 40) return true;
  if (dotChars > letters) return true;
  if (dotChars > body.length * 0.35) return true;
  return false;
}

function extractByHeadings(text, heading) {
  const re = new RegExp(`(?:^|\\n)\\s*(?:\\d+(?:\\.\\d+)*\\.?\\s+)?${heading.source}\\s*(?:\\n|:|\\-|–)?`, "gi");
  let match;
  while ((match = re.exec(text))) {
    const body = sliceUntilNext(text, match.index + match[0].length);
    if (body.length >= 20 && !isTocJunk(body)) return body;
  }
  return null;
}

function splitObjectives(block) {
  if (!block) return { main: null, specific: null };
  const specificAt = block.search(/\n\s*(?:specific\s+objectives?|the\s+specific\s+objectives?)\b/i);
  if (specificAt > 20) {
    return {
      main: clean(block.slice(0, specificAt), 2000) || null,
      specific: clean(block.slice(specificAt).replace(/^[^\n]*\n/, ""), 3000) || null,
    };
  }
  if (/^\s*[\(]?[1iI][\).\]]/m.test(block) && (block.match(/^\s*[\(]?\d/gm) ?? []).length >= 2) {
    return { main: null, specific: clean(block, 3000) };
  }
  return { main: clean(block, 2000), specific: null };
}

function stripTocLines(text) {
  return text
    .split("\n")
    .filter((line) => {
      if (/\.{5,}/.test(line)) return false;
      if (/[·.……]{3,}/.test(line)) return false;
      const dots = (line.match(/\./g) || []).length;
      if (dots > Math.max(8, line.length * 0.25)) return false;
      return true;
    })
    .join("\n");
}

function extractPdfSections(rawText) {
  const text = stripTocLines(rawText.replace(/\r/g, "\n").replace(/[ \t]{2,}/g, " "));
  let problemStatement = extractByHeadings(text, PROBLEM_HEADINGS);
  if (!problemStatement) {
    const abs = extractByHeadings(text, ABSTRACT_HEADING);
    if (abs && abs.length >= 40) problemStatement = clean((abs.split(/\n/)[0] || abs), 1600);
  }
  let specificObjectives = extractByHeadings(text, SPECIFIC_OBJ_HEADINGS);
  let objectives =
    extractByHeadings(text, /(?:general\s+objectives?|main\s+objectives?|overall\s+objectives?)\b/i) ??
    extractByHeadings(text, /(?:1\.\s*4\.\s*1|1\.4\.1)\s+main\s+objectives?\b/i) ??
    extractByHeadings(text, /aim\s+of\s+(?:the\s+)?(?:study|project)\b/i);

  if (!objectives) {
    const block =
      extractByHeadings(text, /(?:1\.\s*4|1\.4)\s+objectives?\b/i) ??
      extractByHeadings(text, /(?:1\.\s*3|1\.3)\s+objectives?\b/i);
    if (block) {
      const split = splitObjectives(block);
      objectives = split.main;
      if (!specificObjectives) specificObjectives = split.specific;
      if (!objectives) {
        const beforeList = block.split(/\n\s*(?:specific\s+objectives?|1\.\s)/i)[0]?.trim();
        if (beforeList && beforeList.length >= 20) objectives = clean(beforeList, 1200);
      }
    }
  }

  if (!specificObjectives && objectives) {
    const split = splitObjectives(objectives);
    if (split.specific) {
      objectives = split.main ?? objectives;
      specificObjectives = split.specific;
    }
  }

  const limitations =
    extractByHeadings(text, RECOMMENDATION_HEADINGS) ??
    extractByHeadings(text, /(?:6\.\s*3|6\.3|7\.\s*2|7\.2|5\.\s*3|5\.3)\s+recommendations?\b/i) ??
    extractByHeadings(text, LIMIT_HEADINGS) ??
    extractByHeadings(text, /(?:1\.\s*6(?:\.\s*2)?|1\.6(?:\.2)?)\s+limitations?\s+of\s+(?:the\s+)?project\b/i) ??
    extractByHeadings(text, /limitation\s+of\s+(?:the\s+)?project\b/i);

  // References: last REFERENCES / bibliography chapter, capped at 5.
  let references = null;
  {
    const heading =
      /(?:^|\n)\s*(?:\d+(?:\.\d+)*\.?\s+)?(?:REFERENCES|BIBLIOGRAPHY|LIST OF REFERENCES|REFERENCE)\s*(?:\n|:)/gi;
    let lastEnd = -1;
    let match;
    while ((match = heading.exec(text))) lastEnd = match.index + match[0].length;
    if (lastEnd >= 0) {
      let body = text.slice(lastEnd);
      const stop = body.search(/\n\s*(?:APPENDIX|APPENDICES|ANNEX|GLOSSARY)\b/i);
      if (stop > 60) body = body.slice(0, stop);
      const chunks = [];
      if (/\[\d+\]/.test(body)) {
        for (const part of body.split(/(?=\[\d+\])/)) {
          const t = part.replace(/\s+/g, " ").replace(/^\[\d+\]\s*/, "").trim();
          if (t.length >= 24) chunks.push(t.slice(0, 500));
        }
      } else {
        for (const line of body.split(/\n/).map((l) => l.replace(/\s+/g, " ").trim())) {
          if (!line || /^\d{1,3}$/.test(line)) continue;
          if (/^(?:appendix|appendices)\b/i.test(line)) break;
          if (/^\[\d+\]/.test(line) || /^\d+\s*[.)]\s+\S/.test(line) || /^[ivx]+\.\s+\S/i.test(line)) {
            chunks.push(line.replace(/^\[\d+\]\s*/, "").replace(/^\d+\s*[.)]\s*/, "").replace(/^[ivx]+\.\s+/i, "").trim().slice(0, 500));
          } else if (chunks.length) {
            chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${line}`.slice(0, 500);
          }
        }
      }
      const uniq = [];
      for (const c of chunks) {
        if (c.length < 24) continue;
        if (uniq.some((u) => u.slice(0, 40).toLowerCase() === c.slice(0, 40).toLowerCase())) continue;
        uniq.push(c);
        if (uniq.length >= 5) break;
      }
      if (uniq.length) references = uniq.map((item, i) => `${i + 1}. ${item}`).join("\n");
    }
  }

  return { problemStatement, objectives, specificObjectives, limitations, references };
}

function existingSection(notes, heading) {
  const re = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  return String(notes || "").match(re)?.[1]?.trim() || null;
}

function mergeNotes(sections, previousNotes = null) {
  const refs = sections.references || existingSection(previousNotes, "References");
  const parts = ["## Enriched from PDF"];
  if (sections.problemStatement) parts.push(`## Problem statement\n${sections.problemStatement}`);
  if (sections.objectives) parts.push(`## Main objective\n${sections.objectives}`);
  if (sections.specificObjectives) parts.push(`## Specific objectives\n${sections.specificObjectives}`);
  if (sections.limitations) parts.push(`## Recommendations\n${sections.limitations}`);
  if (refs) parts.push(`## References\n${refs}`);
  if (parts.length === 1) {
    parts.push("## Recommendations\nNo recommendations section could be read from this PDF.");
  }
  return parts.join("\n\n");
}

function alreadyEnriched(notes) {
  return /##\s*Enriched from PDF\b/i.test(String(notes ?? ""));
}

function isPlaceholder(row) {
  const notes = String(row.notes ?? "");
  const summary = String(row.summary ?? "");
  if (/study and adapt|read the attached|Open the attached PDF|BEng ETE project report/i.test(notes + "\n" + summary)) {
    return true;
  }
  // Re-try rows that were marked enriched but got no real sections.
  if (alreadyEnriched(notes) && !/##\s*Problem statement\b/i.test(notes)) return true;
  if (!alreadyEnriched(notes) && (!/##\s*Problem statement/i.test(notes) || !/##\s*Main objective/i.test(notes))) {
    return true;
  }
  return false;
}

const { data: rows, error } = await db
  .from("title_proposals")
  .select("id, title, summary, notes, origin_ref, communication, status")
  .neq("status", "dropped")
  .not("origin_ref", "is", null)
  .order("created_at", { ascending: true });

if (error) {
  console.error(error.message);
  process.exit(1);
}

const candidates = (rows ?? []).filter((r) => cataloguePathFromOrigin(r.origin_ref) && (force || isPlaceholder(r)));
const work = limit > 0 ? candidates.slice(0, limit) : candidates;

console.log(`Catalogue titles with PDF: ${(rows ?? []).filter((r) => cataloguePathFromOrigin(r.origin_ref)).length}`);
console.log(`To enrich: ${work.length}${force ? " (force)" : ""}${limit ? ` (limit ${limit})` : ""}`);
console.log(`Gemini: ${GEMINI_KEY ? `on (${GEMINI_MODEL})` : "off (regex only — set GEMINI_API_KEY)"}`);

let ok = 0;
let fail = 0;
let empty = 0;
let aiHits = 0;

for (const row of work) {
  const storagePath = cataloguePathFromOrigin(row.origin_ref);
  const label = String(row.title ?? row.id).slice(0, 70);
  try {
    const downloaded = await db.storage.from(BUCKET).download(storagePath);
    if (downloaded.error || !downloaded.data) {
      fail += 1;
      console.log(`FAIL download ${label}: ${downloaded.error?.message ?? "no data"}`);
      continue;
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const text = await pdfText(bytes, 28, 18);
    const sections = await resolvePdfSections(text);
    const found =
      sections.problemStatement || sections.objectives || sections.specificObjectives || sections.limitations;
    if (!found) empty += 1;
    if (sections._ai) aiHits += 1;

    const notes = mergeNotes(sections, row.notes);
    const patch = {
      notes,
      communication: null,
      updated_at: new Date().toISOString(),
    };
    if (sections.problemStatement) patch.summary = sections.problemStatement.slice(0, 1600);

    const { error: upErr } = await db.from("title_proposals").update(patch).eq("id", row.id);
    if (upErr) {
      fail += 1;
      console.log(`FAIL update ${label}: ${upErr.message}`);
      continue;
    }
    ok += 1;
    const via = sections._ai ? `AI:${sections._model || "gemini"}` : "regex";
    console.log(
      `OK ${ok}/${work.length} ${label} · ${via} · P=${sections.problemStatement ? "Y" : "n"} O=${sections.objectives ? "Y" : "n"} S=${sections.specificObjectives ? "Y" : "n"} L=${sections.limitations ? "Y" : "n"}`,
    );
    // Pace requests so free-tier Gemini does not throttle mid-batch.
    if (GEMINI_KEY) await sleep(1200);
  } catch (err) {
    fail += 1;
    console.log(`FAIL ${label}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`Gemini fills used: ${aiHits}/${ok}`);

console.log(`Done. ok=${ok} empty_extract=${empty} fail=${fail}`);
