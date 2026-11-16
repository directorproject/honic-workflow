/**
 * Gemini-assisted fill of FYP brief sections from catalogue PDF text.
 * Server-only — never expose GEMINI_API_KEY to the browser.
 */

import type { PdfSections } from "@/lib/portal/pdf-sections";
import {
  extractPdfSections,
  polishBriefText,
  polishPdfSections,
  polishReferencesText,
} from "@/lib/portal/pdf-sections";

const DEFAULT_MODEL = "gemini-3.6-flash";
const FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest"];

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function geminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

function preferredModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function clipForModel(text: string, maxChars = 120_000): string {
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (cleaned.length <= maxChars) return cleaned;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head - 80;
  return `${cleaned.slice(0, head)}\n\n[...middle omitted...]\n\n${cleaned.slice(-tail)}`;
}

function asNullableString(value: unknown, max = 4000): string | null {
  if (typeof value !== "string") return null;
  const t = value.replace(/\u0000/g, "").trim();
  if (t.length < 12 || /^(null|n\/a|none|not found|missing)$/i.test(t)) return null;
  return t.slice(0, max);
}

function referencesFromAi(value: unknown): string | null {
  if (Array.isArray(value)) {
    const lines = value
      .map((v) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim() : ""))
      .filter((v) => v.length >= 16)
      .slice(0, 5);
    return polishReferencesText(lines.map((l, i) => `${i + 1}. ${l}`).join("\n"));
  }
  if (typeof value === "string") return polishReferencesText(value);
  return null;
}

function sectionsFromAiObject(obj: Record<string, unknown>): PdfSections {
  return polishPdfSections({
    problemStatement: polishBriefText(asNullableString(obj.problemStatement, 4000), "problem"),
    objectives: polishBriefText(asNullableString(obj.mainObjective ?? obj.objectives, 2500), "main"),
    specificObjectives: polishBriefText(asNullableString(obj.specificObjectives, 4000), "specific"),
    limitations: polishBriefText(
      asNullableString(obj.recommendations ?? obj.limitations, 4000),
      "recommendations",
    ),
    references: referencesFromAi(obj.references),
  });
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const text = raw.trim();
  try {
    const direct = JSON.parse(text) as unknown;
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct as Record<string, unknown>;
    }
  } catch {
    /* try fence / slice */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

type GeminiGenerateResult = {
  ok: boolean;
  text: string | null;
  error?: string;
  model: string;
};

async function generateWithModel(model: string, prompt: string, apiKey: string): Promise<GeminiGenerateResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
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

  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } | null;

  if (!res.ok) {
    return {
      ok: false,
      text: null,
      model,
      error: body?.error?.message || `HTTP ${res.status}`,
    };
  }

  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return { ok: Boolean(text.trim()), text: text || null, model };
}

function buildPrompt(pdfText: string): string {
  return `You extract sections from a student final-year project / dissertation PDF (plain text).
Return ONLY a JSON object with these keys (string or null). Keep the author's meaning, but write clean readable portal text.

Rules:
- No figure/table captions, page numbers, citations like [4], or TOC lines.
- Fix obvious OCR/line-break damage; use complete sentences.
- Do not invent facts that are not in the PDF. If a section is missing, use null.

Keys:
- "problemStatement": 1–3 clean paragraphs for the problem statement (not abstract alone unless that is all that exists).
- "mainObjective": One short paragraph for the main/general objective (not the numbered list).
- "specificObjectives": Numbered list only (1. 2. 3. …), one objective per line. No intro sentence like "Below are…".
- "recommendations": Prefer Recommendations / future work. If missing, use scope and limitations — still as clean paragraphs, not captions.
- "references": Array of at most 5 bibliography / REFERENCES entries from the report (plain citation strings). Prefer the first 5 listed. Empty array if none.

PDF text:
---
${clipForModel(pdfText)}
---`;
}

/** Call Gemini and map JSON → PdfSections. Returns null on missing key / hard failure. */
export async function extractPdfSectionsWithGemini(rawText: string): Promise<PdfSections | null> {
  const apiKey = geminiApiKey();
  if (!apiKey) return null;
  if (!rawText || rawText.trim().length < 80) return null;

  const prompt = buildPrompt(rawText);
  const models = [preferredModel(), ...FALLBACK_MODELS.filter((m) => m !== preferredModel())];
  let lastError = "";

  for (const model of models.slice(0, 2)) {
    try {
      const result = await generateWithModel(model, prompt, apiKey);
      if (!result.ok || !result.text) {
        lastError = result.error || "empty response";
        if (/not found|NOT_FOUND|unsupported|invalid model/i.test(lastError)) continue;
        if (/quota|rate|429|high demand|503|RESOURCE_EXHAUSTED/i.test(lastError)) {
          await new Promise((r) => setTimeout(r, 2500));
          const retry = await generateWithModel(model, prompt, apiKey);
          if (retry.ok && retry.text) {
            const obj = parseJsonObject(retry.text);
            if (obj) return sectionsFromAiObject(obj);
          }
          lastError = retry.error || lastError;
          break;
        }
        continue;
      }
      const obj = parseJsonObject(result.text);
      if (!obj) {
        lastError = "invalid JSON";
        continue;
      }
      return sectionsFromAiObject(obj);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  if (lastError && process.env.NODE_ENV !== "production") {
    console.warn("[gemini-extract]", lastError);
  }
  return null;
}

function preferLonger(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length * 1.05 ? b : a;
}

/**
 * Regex first, then Gemini fills gaps / improves thin extracts when GEMINI_API_KEY is set.
 */
export async function resolvePdfSections(rawText: string): Promise<PdfSections> {
  const regex = extractPdfSections(rawText);
  if (!geminiConfigured()) return regex;

  const ai = await extractPdfSectionsWithGemini(rawText);
  if (!ai) return regex;

  return polishPdfSections({
    problemStatement: preferLonger(regex.problemStatement, ai.problemStatement),
    objectives: preferLonger(regex.objectives, ai.objectives),
    specificObjectives: preferLonger(regex.specificObjectives, ai.specificObjectives),
    limitations: preferLonger(regex.limitations, ai.limitations),
    references: preferLonger(regex.references, ai.references),
  });
}
