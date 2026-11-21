import { NextResponse } from "next/server";

import { getPortalUser } from "@/lib/portal/data";
import { consumePreviewSession } from "@/lib/portal/job-escrow";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Secure watermarked preview stream.
 * - Auth required
 * - Short-lived hashed session token
 * - No Content-Disposition attachment
 * - no-store / no-transform
 * - Client must render with overlay; raw URL is never a public signed link
 */
export async function GET(req: Request) {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });

  const url = new URL(req.url);
  const token = String(url.searchParams.get("token") ?? "").trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.json({ ok: false, message: "Invalid preview token." }, { status: 400 });
  }

  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "Unavailable." }, { status: 503 });

  const session = await consumePreviewSession(db, { token, viewerUserId: user.id });
  if (!session.ok) {
    return NextResponse.json({ ok: false, message: session.message }, { status: 403 });
  }

  const { data, error } = await db.storage.from(STORAGE_BUCKET).download(session.storagePath);
  if (error || !data) {
    return NextResponse.json({ ok: false, message: "Preview file missing." }, { status: 404 });
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": session.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      "X-Honic-Watermark": session.watermark,
      "X-Honic-Escrow": session.escrowPublicId.slice(0, 8),
      // Discourage download managers / save-as UX
      "Content-Disposition": "inline; filename=\"nexis-preview.img\"",
    },
  });
}
