import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { getSessionActor } from "@/lib/workspace/access";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open a staff-imported catalogue PDF (signed-in students/staff only).
 * Paths must live under catalogue/ in the portal-files bucket.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const actor = await getSessionActor();
  if (!actor) {
    return new NextResponse("Sign in to open this document.", { status: 401 });
  }

  const { path: parts } = await ctx.params;
  const storagePath = (parts ?? []).map((p) => decodeURIComponent(p)).join("/");
  if (!storagePath || storagePath.includes("..") || !storagePath.startsWith("catalogue/")) {
    return new NextResponse("Not found.", { status: 404 });
  }
  if (!/\.pdf$/i.test(storagePath)) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const db = getSupabaseAdminClient();
  if (!db) return new NextResponse("Unavailable.", { status: 503 });

  const signed = await db.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 5);
  if (!signed.data?.signedUrl) return new NextResponse("Could not open file.", { status: 502 });
  return NextResponse.redirect(signed.data.signedUrl, 302);
}
