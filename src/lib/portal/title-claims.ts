import { createHash, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export type TitleTargetKind = "proposal" | "earlier";
export type TitleClaimStatus = "pending" | "confirmed" | "rejected";
export type TitleClaimKind = "claim" | "new" | "appeal";
export type TitleProofKind = "national_id" | "student_id" | "passport" | "other" | "questions";
export type TitleProofMethod = "upload" | "questions";
export type TitleEvidenceKind = "project_document" | "id_proof" | "reference";

/** Fixed ownership questions shown to the student and reviewed by admin. */
export const OWNERSHIP_QUESTIONS = [
  { id: "year", label: "What year did you finish or work on this project?" },
  { id: "place", label: "Which institution / college was this for?" },
  { id: "supervisor", label: "Who supervised you (name), if any?" },
  { id: "reg", label: "What was your student registration number?" },
  { id: "unique", label: "Name one detail only the real author would know (tool, circuit, result, or partner)." },
] as const;

export type TitleClaim = {
  id: string;
  publicId: string;
  requesterId: string;
  requestKind: TitleClaimKind;
  status: TitleClaimStatus;
  targetKind: TitleTargetKind | null;
  targetId: string | null;
  title: string;
  explanation: string | null;
  courseCode: string | null;
  institution: string | null;
  idNumber: string | null;
  proofKind: TitleProofKind | null;
  proofMethod: TitleProofMethod | null;
  proofAnswers: Record<string, string> | null;
  integrityHash: string | null;
  sealedAt: string | null;
  createdAt: string;
};

export type TitleClaimEvidence = {
  id: string;
  publicId: string;
  claimId: string;
  kind: TitleEvidenceKind;
  name: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
};

export type PublishedDocument = {
  id: string;
  name: string;
  storagePath: string;
  mimeType: string | null;
  publishedAt: string;
};

export type OwnershipCatalogueItem = {
  id: string;
  routeId: string;
  title: string;
  kind: TitleTargetKind;
  yearLabel: string | null;
  owned: boolean;
};

export function strongId(): string {
  return randomBytes(32).toString("hex");
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sealClaimIntegrity(parts: {
  publicId: string;
  requesterId: string;
  requestKind: TitleClaimKind;
  title: string;
  targetKind: string;
  targetId: string;
  idNumber: string;
  proofKind: string;
  proofMethod: string;
  explanation: string;
  answersSeal: string;
  evidenceHashes: string[];
}): string {
  const body = [
    parts.publicId,
    parts.requesterId,
    parts.requestKind,
    parts.title,
    parts.targetKind,
    parts.targetId,
    parts.idNumber,
    parts.proofKind,
    parts.proofMethod,
    parts.explanation,
    parts.answersSeal,
    ...[...parts.evidenceHashes].sort(),
  ].join("|");
  return sha256Hex(body);
}

function missingRelation(message: string): boolean {
  return /portal_title_claims|portal_title_documents|portal_title_claim_evidence|public_id|does not exist|schema cache/i.test(message);
}

const CLAIM_SELECT =
  "id, public_id, requester_id, request_kind, status, target_kind, target_id, title, explanation, course_code, institution, id_number, proof_kind, proof_method, proof_answers, integrity_hash, sealed_at, created_at";

export async function confirmedProposalIds(db: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await db
    .from("portal_title_claims")
    .select("target_id")
    .eq("status", "confirmed")
    .eq("target_kind", "proposal");
  if (error) return new Set();
  return new Set((data ?? []).map((row) => String(row.target_id)).filter(Boolean));
}

export async function confirmedTargetKeys(db: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await db
    .from("portal_title_claims")
    .select("target_kind, target_id")
    .eq("status", "confirmed")
    .not("target_id", "is", null);
  if (error) return new Set();
  return new Set((data ?? []).map((row) => `${row.target_kind}:${row.target_id}`));
}

export async function claimsForTarget(
  db: SupabaseClient,
  kind: TitleTargetKind,
  targetId: string,
): Promise<TitleClaim[]> {
  const { data, error } = await db
    .from("portal_title_claims")
    .select(CLAIM_SELECT)
    .eq("target_kind", kind)
    .eq("target_id", targetId)
    .in("status", ["pending", "confirmed"])
    .order("created_at", { ascending: false });
  if (error) {
    if (missingRelation(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map(asClaim);
}

export async function claimsForUser(db: SupabaseClient, userId: string): Promise<TitleClaim[]> {
  const { data, error } = await db
    .from("portal_title_claims")
    .select(CLAIM_SELECT)
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingRelation(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map(asClaim);
}

export async function pendingClaims(db: SupabaseClient): Promise<TitleClaim[]> {
  const { data, error } = await db
    .from("portal_title_claims")
    .select(CLAIM_SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    if (missingRelation(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map(asClaim);
}

export async function countPendingClaims(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from("portal_title_claims")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    if (missingRelation(error.message)) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function evidenceForClaims(db: SupabaseClient, claimIds: string[]): Promise<TitleClaimEvidence[]> {
  if (!claimIds.length) return [];
  const { data, error } = await db
    .from("portal_title_claim_evidence")
    .select("id, public_id, claim_id, kind, name, storage_path, mime_type, size_bytes, sha256, created_at")
    .in("claim_id", claimIds)
    .order("created_at", { ascending: true });
  if (error) {
    if (missingRelation(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map(asEvidence);
}

export async function publishedDocuments(db: SupabaseClient, claimIds: string[]): Promise<PublishedDocument[]> {
  if (!claimIds.length) return [];
  const { data, error } = await db
    .from("portal_title_documents")
    .select("id, name, storage_path, mime_type, published_at")
    .in("claim_id", claimIds)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  if (error) {
    if (missingRelation(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? "Document"),
    storagePath: String(row.storage_path),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    publishedAt: String(row.published_at),
  }));
}

export async function titlePublicId(db: SupabaseClient, kind: TitleTargetKind, id: string): Promise<string | null> {
  const table = kind === "earlier" ? "last_year_projects" : "title_proposals";
  const { data, error } = await db.from(table).select("public_id").eq("id", id).maybeSingle();
  if (error || !data?.public_id) return null;
  return String(data.public_id);
}

/** Catalogue for ownership claims: every listed title plus whether it already has a confirmed owner. */
export async function listOwnershipCatalogue(db: SupabaseClient): Promise<OwnershipCatalogueItem[]> {
  const owned = await confirmedTargetKeys(db);
  // title_proposals has no `source` column — selecting it made the whole proposals query fail silently.
  // Use the same columns as literature review — `source`/`year` are not on every table.
  const [{ data: proposals, error: proposalError }, { data: earlier, error: earlierError }] = await Promise.all([
    db.from("title_proposals").select("id, title, batch").neq("status", "dropped").order("title"),
    db.from("last_year_projects").select("id, title, source, programme").order("title"),
  ]);
  if (proposalError) throw new Error(proposalError.message);
  if (earlierError) throw new Error(earlierError.message);

  const items: OwnershipCatalogueItem[] = [];
  for (const row of proposals ?? []) {
    const id = String(row.id);
    items.push({
      id,
      routeId: id,
      title: String(row.title ?? "").trim(),
      kind: "proposal",
      yearLabel: row.batch ? String(row.batch) : null,
      owned: owned.has(`proposal:${id}`),
    });
  }
  for (const row of earlier ?? []) {
    const id = String(row.id);
    items.push({
      id,
      routeId: `earlier:${id}`,
      title: String(row.title ?? "").trim(),
      kind: "earlier",
      yearLabel: row.source ? String(row.source) : row.programme ? String(row.programme) : null,
      owned: owned.has(`earlier:${id}`),
    });
  }
  return items.sort((a, b) => a.title.localeCompare(b.title));
}

function asClaim(row: Record<string, unknown>): TitleClaim {
  const status = String(row.status);
  const requestKind = String(row.request_kind);
  const targetKind = row.target_kind ? String(row.target_kind) : null;
  const proofKind = row.proof_kind ? String(row.proof_kind) : null;
  const proofMethod = row.proof_method ? String(row.proof_method) : null;
  const rawAnswers = row.proof_answers;
  let proofAnswers: Record<string, string> | null = null;
  if (rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)) {
    proofAnswers = Object.fromEntries(
      Object.entries(rawAnswers as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "").trim()]),
    );
  }
  return {
    id: String(row.id),
    publicId: String(row.public_id ?? ""),
    requesterId: String(row.requester_id),
    requestKind: requestKind === "new" || requestKind === "appeal" ? requestKind : "claim",
    status: status === "confirmed" || status === "rejected" ? status : "pending",
    targetKind: targetKind === "earlier" || targetKind === "proposal" ? targetKind : null,
    targetId: row.target_id ? String(row.target_id) : null,
    title: String(row.title ?? ""),
    explanation: row.explanation ? String(row.explanation) : null,
    courseCode: row.course_code ? String(row.course_code) : null,
    institution: row.institution ? String(row.institution) : null,
    idNumber: row.id_number ? String(row.id_number) : null,
    proofKind:
      proofKind === "national_id" ||
      proofKind === "student_id" ||
      proofKind === "passport" ||
      proofKind === "other" ||
      proofKind === "questions"
        ? proofKind
        : null,
    proofMethod: proofMethod === "upload" || proofMethod === "questions" ? proofMethod : null,
    proofAnswers,
    integrityHash: row.integrity_hash ? String(row.integrity_hash) : null,
    sealedAt: row.sealed_at ? String(row.sealed_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function asEvidence(row: Record<string, unknown>): TitleClaimEvidence {
  const kind = String(row.kind);
  return {
    id: String(row.id),
    publicId: String(row.public_id ?? ""),
    claimId: String(row.claim_id),
    kind: kind === "id_proof" || kind === "reference" ? kind : "project_document",
    name: String(row.name ?? "Evidence"),
    storagePath: String(row.storage_path),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    sizeBytes: Number(row.size_bytes ?? 0),
    sha256: String(row.sha256 ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export function claimKindLabel(kind: TitleClaimKind): string {
  if (kind === "new") return "New title with documents";
  if (kind === "appeal") return "Ownership appeal";
  return "Claim of an existing title";
}
