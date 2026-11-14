import { NextResponse } from "next/server";

import { isStaffUser } from "@/lib/auth-staff";
import { isPublicId } from "@/lib/portal/accounts";
import { getPortalUser } from "@/lib/portal/data";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Staff-only short-lived redirect to claim evidence. Never exposes storage paths in page HTML. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  const user = await getPortalUser();
  if (!user || !isStaffUser(user)) {
    return NextResponse.json({ error: "Staff access required." }, { status: 401 });
  }

  const { publicId: raw } = await context.params;
  const publicId = String(raw ?? "").trim().toLowerCase();
  if (!isPublicId(publicId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const db = getSupabaseServiceRoleClient();
  if (!db) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const { data: evidence, error } = await db
    .from("portal_title_claim_evidence")
    .select("storage_path, name")
    .eq("public_id", publicId)
    .maybeSingle();
  if (error || !evidence?.storage_path) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: signed, error: signError } = await db.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(String(evidence.storage_path), 120);
  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not open file." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
