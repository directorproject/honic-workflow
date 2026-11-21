import { NextResponse } from "next/server";

import { getPortalUser } from "@/lib/portal/data";
import { authorizeFinalDownload } from "@/lib/portal/job-escrow";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Final deliverable download — poster only after escrow release; helper always. */
export async function GET(req: Request) {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });

  const id = String(new URL(req.url).searchParams.get("id") ?? "").trim();
  if (!id || id.length < 16) {
    return NextResponse.json({ ok: false, message: "Missing deliverable id." }, { status: 400 });
  }

  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "Unavailable." }, { status: 503 });

  const authz = await authorizeFinalDownload(db, { userId: user.id, deliverablePublicId: id });
  if (!authz.ok) {
    return NextResponse.json({ ok: false, message: authz.message }, { status: 403 });
  }

  const { data, error } = await db.storage.from(STORAGE_BUCKET).download(authz.storagePath);
  if (error || !data) {
    return NextResponse.json({ ok: false, message: "File missing." }, { status: 404 });
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  const safeName = authz.fileName.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120) || "deliverable";
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": authz.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${safeName}"`,
    },
  });
}
