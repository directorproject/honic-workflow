"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import {
  OWNERSHIP_QUESTIONS,
  sealClaimIntegrity,
  sha256Hex,
  strongId,
  type TitleClaimKind,
  type TitleEvidenceKind,
  type TitleProofMethod,
  type TitleTargetKind,
} from "@/lib/portal/title-claims";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { MAX_UPLOAD_BYTES, STORAGE_BUCKET } from "@/lib/workspace/constants";

const BACK = "/portal/home?tab=projects";
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_EXT = /\.(pdf|docx?|pptx?|png|jpe?g|webp)$/i;

function clean(value: unknown, max = 400): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function go(notice: string): never {
  redirect(`${BACK}${BACK.includes("?") ? "&" : "?"}notice=${notice}`);
}

async function studentDb() {
  const user = await getPortalUser();
  if (!user) go("signin");
  if (isStaffUser(user)) redirect("/titles");
  const db = getSupabaseAdminClient();
  if (!db) go("unavailable");
  return { user, db };
}

function filesOf(formData: FormData, key: string): File[] {
  return formData
    .getAll(key)
    .filter((v): v is File => v instanceof File && v.size > 0)
    .slice(0, 12);
}

function validateFiles(files: File[], label: string) {
  if (!files.length) throw new Error(`Add at least one ${label}.`);
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mime) && !ALLOWED_EXT.test(file.name)) {
      throw new Error(`${file.name} must be PDF, Word, PowerPoint, or an image.`);
    }
  }
}

type PreparedEvidence = {
  kind: TitleEvidenceKind;
  name: string;
  bytes: Buffer;
  mime: string;
  size: number;
  sha256: string;
  storagePath: string;
  publicId: string;
};

async function prepareEvidence(claimId: string, kind: TitleEvidenceKind, files: File[]): Promise<PreparedEvidence[]> {
  const out: PreparedEvidence[] = [];
  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 80) || kind;
    const publicId = strongId();
    out.push({
      kind,
      name: clean(file.name, 160) || safeName,
      bytes,
      mime: file.type || "application/octet-stream",
      size: file.size,
      sha256: sha256Hex(bytes),
      storagePath: `title-claim-evidence/${claimId}/${publicId}-${safeName}`,
      publicId,
    });
  }
  return out;
}

/** Submit a sealed ownership request after search → documents → proof. */
export async function submitOwnershipClaim(formData: FormData) {
  const { user, db } = await studentDb();

  try {
    const mode = clean(formData.get("mode"), 20);
    const titleInput = clean(formData.get("title"), 300);
    const targetRoute = clean(formData.get("targetRouteId"), 120);
    const proofMethodRaw = clean(formData.get("proofMethod"), 20);
    const proofMethod: TitleProofMethod = proofMethodRaw === "questions" ? "questions" : "upload";
    const idNumber = clean(formData.get("idNumber"), 80);

    const projectDocs = filesOf(formData, "projectDocuments");
    const idProofs = filesOf(formData, "idProofs");

    validateFiles(projectDocs, "project document");

    const answers: Record<string, string> = {};
    if (proofMethod === "questions") {
      for (const question of OWNERSHIP_QUESTIONS) {
        const answer = clean(formData.get(`answer_${question.id}`), 800);
        if (answer.length < 2) go("answers");
        answers[question.id] = answer;
      }
    } else {
      validateFiles(idProofs, "ownership proof");
    }

    let requestKind: TitleClaimKind;
    let targetKind: TitleTargetKind | null = null;
    let targetId: string | null = null;
    let title = titleInput;

    if (mode === "new" || (!targetRoute && titleInput)) {
      requestKind = "new";
      if (!title || title.length < 8) go("missing");
    } else {
      if (!targetRoute) go("pick_title");
      if (targetRoute.startsWith("earlier:")) {
        targetKind = "earlier";
        targetId = targetRoute.slice("earlier:".length);
      } else {
        targetKind = "proposal";
        targetId = targetRoute;
      }
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) go("pick_title");

      const table = targetKind === "earlier" ? "last_year_projects" : "title_proposals";
      const { data: row } = await db.from(table).select("id, title").eq("id", targetId).maybeSingle();
      if (!row) go("pick_title");
      title = String(row.title ?? titleInput);
      if (!title) go("missing");

      const { data: confirmed } = await db
        .from("portal_title_claims")
        .select("id, requester_id")
        .eq("target_kind", targetKind)
        .eq("target_id", targetId)
        .eq("status", "confirmed")
        .maybeSingle();

      if (confirmed) {
        if (String(confirmed.requester_id) === user.id) go("yours");
        requestKind = "appeal";
      } else {
        requestKind = "claim";
      }
    }

    if (targetId) {
      const { data: waiting } = await db
        .from("portal_title_claims")
        .select("id")
        .eq("requester_id", user.id)
        .eq("target_kind", targetKind)
        .eq("target_id", targetId)
        .eq("status", "pending")
        .maybeSingle();
      if (waiting) go("waiting");
    }

    const { data: profile } = await db
      .from("student_profiles")
      .select("course_code, institution")
      .eq("user_id", user.id)
      .maybeSingle();

    const claimPublicId = strongId();
    const claimId = randomUUID();
    const sealedAt = new Date().toISOString();
    const explanation =
      proofMethod === "questions"
        ? OWNERSHIP_QUESTIONS.map((q) => `${q.label} ${answers[q.id] ?? ""}`).join(" · ").slice(0, 4000)
        : "Ownership proof uploaded with project documents.";

    const evidence = [
      ...(await prepareEvidence(claimId, "project_document", projectDocs)),
      ...(proofMethod === "upload" ? await prepareEvidence(claimId, "id_proof", idProofs) : []),
    ];

    const answersSeal = proofMethod === "questions" ? sha256Hex(JSON.stringify(answers)) : "";
    const proofKind = proofMethod === "questions" ? "questions" : idNumber ? "other" : "other";

    const integrityHash = sealClaimIntegrity({
      publicId: claimPublicId,
      requesterId: user.id,
      requestKind,
      title,
      targetKind: targetKind ?? "",
      targetId: targetId ?? "",
      idNumber,
      proofKind,
      proofMethod,
      explanation,
      answersSeal,
      evidenceHashes: evidence.map((e) => e.sha256),
    });

    const { error: insertError } = await db.from("portal_title_claims").insert({
      id: claimId,
      public_id: claimPublicId,
      requester_id: user.id,
      request_kind: requestKind,
      status: "pending",
      target_kind: targetKind,
      target_id: targetId,
      title,
      explanation,
      course_code: profile?.course_code ? String(profile.course_code) : null,
      institution: profile?.institution ? String(profile.institution) : null,
      id_number: idNumber || null,
      proof_kind: proofKind,
      proof_method: proofMethod,
      proof_answers: proofMethod === "questions" ? answers : null,
      integrity_hash: integrityHash,
      sealed_at: sealedAt,
    });
    if (insertError) {
      if (/proof_method|proof_answers|integrity_hash|id_number|proof_kind|sealed_at|appeal|portal_title_claim_evidence/i.test(insertError.message)) {
        go("migrate");
      }
      go("unavailable");
    }

    const uploadedPaths: string[] = [];
    try {
      for (const item of evidence) {
        const uploaded = await db.storage.from(STORAGE_BUCKET).upload(item.storagePath, item.bytes, {
          contentType: item.mime,
          upsert: false,
        });
        if (uploaded.error) throw new Error(uploaded.error.message);
        uploadedPaths.push(item.storagePath);
        const { error: evError } = await db.from("portal_title_claim_evidence").insert({
          public_id: item.publicId,
          claim_id: claimId,
          kind: item.kind,
          name: item.name,
          storage_path: item.storagePath,
          size_bytes: item.size,
          mime_type: item.mime,
          sha256: item.sha256,
        });
        if (evError) throw new Error(evError.message);
      }
    } catch {
      if (uploadedPaths.length) await db.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
      await db.from("portal_title_claims").delete().eq("id", claimId).eq("requester_id", user.id).eq("status", "pending");
      go("upload");
    }

    revalidatePath("/portal");
    revalidatePath("/titles");
    go(requestKind === "appeal" ? "appealed" : requestKind === "new" ? "posted" : "claimed");
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/project document|ownership proof|25 MB|PDF|PowerPoint/i.test(message)) go("files");
    go("unavailable");
  }
}

/** Confirmed owners may still publish catalogue documents after review. */
export async function publishTitleDocument(formData: FormData) {
  const { user, db } = await studentDb();
  const claimId = clean(formData.get("claimId"), 80);
  const routeId = clean(formData.get("routeId"), 120);
  const name = clean(formData.get("name"), 160);
  const file = formData.get("file");
  const back = routeId ? `/portal/titles/${encodeURIComponent(routeId)}` : BACK;
  if (!claimId || !name || !(file instanceof File) || file.size <= 0) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}notice=missing`);
  }
  if (file.size > MAX_UPLOAD_BYTES) redirect(`${back}${back.includes("?") ? "&" : "?"}notice=large`);

  const { data: claim, error } = await db
    .from("portal_title_claims")
    .select("id, requester_id, status")
    .eq("id", claimId)
    .maybeSingle();
  if (error || !claim || claim.status !== "confirmed" || String(claim.requester_id) !== user.id) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}notice=owner`);
  }

  const safeName = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 80) || "document";
  const storagePath = `title-claims/${claimId}/${strongId()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await db.storage.from(STORAGE_BUCKET).upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploaded.error) redirect(`${back}${back.includes("?") ? "&" : "?"}notice=upload`);

  const { error: insertError } = await db.from("portal_title_documents").insert({
    public_id: strongId(),
    claim_id: claimId,
    name,
    storage_path: storagePath,
    size_bytes: file.size,
    mime_type: file.type || null,
    published_at: new Date().toISOString(),
  });
  if (insertError) {
    await db.storage.from(STORAGE_BUCKET).remove([storagePath]);
    redirect(`${back}${back.includes("?") ? "&" : "?"}notice=unavailable`);
  }
  revalidatePath(back);
  revalidatePath("/portal");
  redirect(`${back}${back.includes("?") ? "&" : "?"}notice=published`);
}
