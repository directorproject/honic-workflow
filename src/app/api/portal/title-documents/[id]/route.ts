import { NextResponse, type NextRequest } from "next/server";

import { recordTitleDocumentBuy } from "@/lib/portal/title-engagement";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { getSessionActor } from "@/lib/workspace/access";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open a published title document (signed-in students/staff only).
 * Counts a buy for the confirmed owner (non-owner viewers; once per viewer per document).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  await recordTitleDocumentBuy(db, {
    targetKind: claim.target_kind as "proposal" | "earlier",
    targetId: String(claim.target_id),
    documentId: String(doc.id),
    viewerId: actor.userId,
    ownerId: String(claim.requester_id),
    isStaff,
  });

  const signed = await db.storage.from(STORAGE_BUCKET).createSignedUrl(String(doc.storage_path), 60 * 5);
  if (!signed.data?.signedUrl) return new NextResponse("Could not open file.", { status: 502 });

  const url = new URL(signed.data.signedUrl);
  return NextResponse.redirect(url.toString(), 302);
}
