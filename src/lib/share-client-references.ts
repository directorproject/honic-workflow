export type ShareResearchLink = { label: string; url: string };

const MAX_LINKS = 25;
const MAX_LABEL = 160;
const MAX_URL = 2048;

export function normalizeShareResearchLinks(raw: unknown): ShareResearchLink[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  const out: ShareResearchLink[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const label = String(rec.label ?? "").trim().slice(0, MAX_LABEL);
    const url = String(rec.url ?? "").trim().slice(0, MAX_URL);
    if (!label || !url) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    } catch {
      continue;
    }
    out.push({ label, url });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

export function hasShareClientReferencesContent(notes: string | null | undefined, links: unknown): boolean {
  const n = (notes ?? "").trim();
  if (n.length > 0) return true;
  return normalizeShareResearchLinks(links).length > 0;
}
