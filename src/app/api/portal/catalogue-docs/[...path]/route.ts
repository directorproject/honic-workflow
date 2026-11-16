import { NextResponse, type NextRequest } from "next/server";

import { hasProjectDocumentsAccess } from "@/lib/portal/document-access";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { getSessionActor } from "@/lib/workspace/access";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * View a staff-imported catalogue PDF (signed-in; paid desk or DOC unlock).
 * Streams inline — no long-lived public URL, download button discouraged.
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

  const isStaff = actor.kind === "staff";
  let deskExpiresAt: string | null = null;
  if (!isStaff) {
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
  });
  if (!allowed) {
    return new NextResponse(
      "Project source files unlock with an active Nexis Desk plan or a project-documents payment.",
      { status: 402 },
    );
  }

  const downloaded = await db.storage.from(STORAGE_BUCKET).download(storagePath);
  if (downloaded.error || !downloaded.data) {
    return new NextResponse("Could not open file.", { status: 502 });
  }

  const bytes = await downloaded.data.arrayBuffer();
  const filename = storagePath.split("/").pop() || "report.pdf";
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
