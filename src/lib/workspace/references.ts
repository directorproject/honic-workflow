import { formatDate } from "@/lib/workspace/dates";
import type { Reference } from "@/lib/workspace/types";

function authorList(raw: string | null): string[] {
  return (raw ?? "")
    .split(/;|\band\b/)
    .map((a) => a.trim())
    .filter(Boolean);
}

/** "Juma Ali Hassan" or "Hassan, Juma Ali" to initials-first ("J. A. Hassan") for IEEE. */
function ieeeName(name: string): string {
  const [last, first] = name.includes(",") ? name.split(",").map((s) => s.trim()) : [name.split(" ").pop() ?? name, name.split(" ").slice(0, -1).join(" ")];
  const initials = (first ?? "").split(/\s+/).filter(Boolean).map((p) => `${p[0]}.`).join(" ");
  return initials ? `${initials} ${last}` : last;
}

/** To "Hassan, J. A." for APA. */
function apaName(name: string): string {
  const [last, first] = name.includes(",") ? name.split(",").map((s) => s.trim()) : [name.split(" ").pop() ?? name, name.split(" ").slice(0, -1).join(" ")];
  const initials = (first ?? "").split(/\s+/).filter(Boolean).map((p) => `${p[0]}.`).join(" ");
  return initials ? `${last}, ${initials}` : last;
}

function joinAuthors(names: string[], last: string): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")}, ${last} ${names[names.length - 1]}`;
}

export function formatIeee(r: Reference, index: number): string {
  const authors = joinAuthors(authorList(r.authors).map(ieeeName), "and");
  const lead = authors ? `${authors}, ` : "";
  const access = r.accessed_on ? ` [Accessed: ${formatDate(r.accessed_on)}]` : "";
  const doi = r.doi ? ` doi: ${r.doi}.` : "";
  let body: string;
  switch (r.kind) {
    case "book":
      body = `${lead}${r.title}. ${[r.source, r.year].filter(Boolean).join(", ")}.`;
      break;
    case "website":
    case "datasheet":
      body = `${lead}"${r.title}," ${r.source ? `${r.source}, ` : ""}${r.year ? `${r.year}. ` : ""}[Online]. Available: ${r.url ?? ""}${access}`;
      break;
    case "thesis":
      body = `${lead}"${r.title}," ${[r.source, r.year].filter(Boolean).join(", ")}.`;
      break;
    default:
      body = `${lead}"${r.title}," ${[r.source, r.volume ? `vol. ${r.volume}` : null, r.pages ? `pp. ${r.pages}` : null, r.year]
        .filter(Boolean)
        .join(", ")}.${doi}`;
  }
  return `[${index}] ${body.replace(/\s+/g, " ").trim()}`;
}

export function formatApa(r: Reference): string {
  const names = authorList(r.authors).map(apaName);
  const authors = names.length > 1 ? `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}` : (names[0] ?? "");
  const year = `(${r.year || "n.d."})`;
  const doi = r.doi ? ` https://doi.org/${r.doi.replace(/^https?:\/\/doi\.org\//, "")}` : r.url ? ` ${r.url}` : "";
  let body: string;
  switch (r.kind) {
    case "book":
      body = `${authors} ${year}. ${r.title}. ${r.source ?? ""}.`;
      break;
    case "website":
    case "datasheet":
      body = `${authors || r.source || ""} ${year}. ${r.title}.${r.source && authors ? ` ${r.source}.` : ""}${doi}`;
      return body.replace(/\s+/g, " ").trim();
    default:
      body = `${authors} ${year}. ${r.title}. ${[r.source, r.volume, r.pages].filter(Boolean).join(", ")}.`;
  }
  return `${body}${doi}`.replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
}
