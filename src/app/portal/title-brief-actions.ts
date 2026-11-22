"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaffActor } from "@/lib/auth-staff";
import { pdfTextFromBytesHeadTail } from "@/lib/portal/enrich-title-from-pdf";
import { resolvePdfSections } from "@/lib/portal/gemini-extract-sections";
import { mergeSectionsIntoNotes } from "@/lib/portal/pdf-sections";
import { revalidatePortalCatalogue } from "@/lib/portal/portal-catalogue-cache";
import { isTemporaryBrief } from "@/lib/portal/temporary-title-brief";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function clean(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function backPath(routeId: string): string {
  return `/portal/titles/${encodeURIComponent(routeId)}`;
}

function parseTarget(routeId: string): { kind: "study" | "earlier"; id: string } | null {
  const id = clean(routeId, 160);
  if (!id) return null;
  if (id.startsWith("earlier:")) return { kind: "earlier", id: id.slice("earlier:".length) };
  if (/^[0-9a-f-]{36}$/i.test(id)) return { kind: "study", id };
  return null;
}

/** Staff: clear temporary starter brief so a PDF can replace it. */
export async function clearTemporaryTitleBriefAction(formData: FormData) {
  await requireStaffActor();
  const db = getSupabaseAdminClient();
  if (!db) redirect("/portal/titles?notice=unavailable");

  const routeId = clean(formData.get("routeId"), 160);
  const target = parseTarget(routeId);
  const back = backPath(routeId || "x");
  if (!target) redirect(`${back}?notice=missing`);

  if (target.kind === "study") {
    const { data: row } = await db.from("title_proposals").select("id, notes").eq("id", target.id).maybeSingle();
    if (!row) redirect(`${back}?notice=missing`);
    if (row.notes && !isTemporaryBrief(row.notes)) redirect(`${back}?notice=missing`);
    await db
      .from("title_proposals")
      .update({ notes: null, updated_at: new Date().toISOString() })
      .eq("id", target.id);
  } else {
    const { data: row } = await db.from("last_year_projects").select("id, notes").eq("id", target.id).maybeSingle();
    if (!row) redirect(`${back}?notice=missing`);
    if (row.notes && !isTemporaryBrief(row.notes)) redirect(`${back}?notice=missing`);
    await db
      .from("last_year_projects")
      .update({ notes: null, updated_at: new Date().toISOString() })
      .eq("id", target.id);
  }

  revalidatePortalCatalogue();
  revalidatePath(back);
  revalidatePath("/portal/titles");
  redirect(`${back}?notice=brief_cleared`);
}

/** Staff: upload a PDF, replace temporary brief, rewrite problem/objectives from the PDF. */
export async function rewriteTitleBriefFromPdfAction(formData: FormData) {
  await requireStaffActor();
  const db = getSupabaseAdminClient();
  if (!db) redirect("/portal/titles?notice=unavailable");

  const routeId = clean(formData.get("routeId"), 160);
  const target = parseTarget(routeId);
  const back = backPath(routeId || "x");
  const file = formData.get("file");
  if (!target) redirect(`${back}?notice=missing`);
  if (!(file instanceof File) || file.size <= 0) redirect(`${back}?notice=missing`);
  if (file.size > MAX_PDF_BYTES) redirect(`${back}?notice=large`);
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") redirect(`${back}?notice=files`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 80) || "report.pdf";
  const storagePath = `catalogue/briefs/${target.kind}-${target.id}-${Date.now()}-${safeName}`;
  const uploaded = await db.storage.from(STORAGE_BUCKET).upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploaded.error) redirect(`${back}?notice=upload`);

  const originRef = `/api/portal/catalogue-docs/${storagePath
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/")}`;

  try {
    const text = await pdfTextFromBytesHeadTail(bytes, { headPages: 28, tailPages: 30 });
    const sections = await resolvePdfSections(text);
    const notes = mergeSectionsIntoNotes(null, sections);
    const problem = sections.problemStatement;

    if (target.kind === "study") {
      const { data: row } = await db.from("title_proposals").select("id, summary").eq("id", target.id).maybeSingle();
      if (!row) throw new Error("missing");
      await db
        .from("title_proposals")
        .update({
          notes,
          summary: problem ? problem.slice(0, 1600) : row.summary,
          origin_ref: originRef,
          communication: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);
    } else {
      await db
        .from("last_year_projects")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", target.id);
    }
  } catch {
    await db.storage.from(STORAGE_BUCKET).remove([storagePath]);
    redirect(`${back}?notice=upload`);
  }

  revalidatePortalCatalogue();
  revalidatePath(back);
  revalidatePath("/portal/titles");
  redirect(`${back}?notice=brief_rewritten`);
}
