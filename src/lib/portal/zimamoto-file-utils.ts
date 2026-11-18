// Pure helpers shared by server and client code. Keep this file free of server-only imports.

/** "Proposal v2.pdf" and "proposal.pdf" share one family, so re-uploads group as versions. */
export function fileFamilyKey(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").toLowerCase().trim();
  return base.replace(/[\s_-]*(v\d+|copy|\(\d+\))$/i, "").replace(/\s+/g, " ").trim() || base;
}
