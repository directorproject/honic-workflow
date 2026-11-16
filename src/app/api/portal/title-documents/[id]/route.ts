import { NextResponse, type NextRequest } from "next/server";

import { hasProjectDocumentsAccess } from "@/lib/portal/document-access";
import { recordTitleDocumentBuy } from "@/lib/portal/title-engagement";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { getSessionActor } from "@/lib/workspace/access";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * View a published title document (signed-in; paid desk / DOC unlock / owner).
 * Streams inline when possible — avoids handing out a long-lived download URL.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getSessionActor();
  if (!actor) {
    return new NextResponse("Sign in to open this document.", { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const db = getSupabaseAdminClient();
  if (!db) return new NextResponse("Unavailable.", { status: 503 });

  const { data: doc, error } = await db
    .from("portal_title_documents")
    .select("id, name, storage_path, mime_type, claim_id, published_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !doc || !doc.published_at) return new NextResponse("Not found.", { status: 404 });

  const { data: claim } = await db
    .from("portal_title_claims")
    .select("id, requester_id, status, target_kind, target_id")
    .eq("id", doc.claim_id)
    .maybeSingle();
  if (!claim || claim.status !== "confirmed" || !claim.target_kind || !claim.target_id) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const isStaff = actor.kind === "staff";
  const isOwner = String(claim.requester_id) === actor.userId;
  let deskExpiresAt: string | null = null;
  if (!isStaff && !isOwner) {
    const { data: profile } = await db
      .from("student_profiles")
      .select("desk_expires_at")
      .eq("user_id", actor.userId)
      .maybeSingle();
    deskExpiresAt = profile?.desk_expires_at ? String(profile.desk_expires_at) : null;
  }

  const allowed = await hasProjectDocumentsAccess(db, {
    userId: actor.userId,
    deskExpiresAt,
    isStaff,
    isDocumentOwner: isOwner,
  });
  if (!allowed) {
    return new NextResponse(
      "Project source files unlock with an active Nexis Desk plan or a project-documents payment.",
      { status: 402 },
    );
  }

  await recordTitleDocumentBuy(db, {
    targetKind: claim.target_kind as "proposal" | "earlier",
    targetId: String(claim.target_id),
    documentId: String(doc.id),
    viewerId: actor.userId,
    ownerId: String(claim.requester_id),
    isStaff,
  });

  const downloaded = await db.storage.from(STORAGE_BUCKET).download(String(doc.storage_path));
  if (downloaded.error || !downloaded.data) {
    return new NextResponse("Could not open file.", { status: 502 });
  }

  const bytes = await downloaded.data.arrayBuffer();
  const mime = String(doc.mime_type || "application/pdf");
  const safeName = String(doc.name || "document").replace(/"/g, "");
  const disposition = mime.includes("pdf") ? "inline" : "inline";
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
