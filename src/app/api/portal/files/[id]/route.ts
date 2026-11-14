import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership, getSessionActor, supervisorCanAccessWorkspace } from "@/lib/workspace/access";
import { fileResponse, readableWorkspaceId } from "@/lib/workspace/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = request.nextUrl.searchParams.get("t");
  const db = getSupabaseAdminClient();
  if (!db) return new NextResponse("Unavailable.", { status: 503 });

  const { data: file } = await db.from("portal_files").select("workspace_id, document_id").eq("id", id).maybeSingle();
  if (!file) return new NextResponse("Not found.", { status: 404 });
  const wsId = String(file.workspace_id);
  const workspaceId = await readableWorkspaceId({ token, workspaceId: wsId });
  if (!workspaceId || workspaceId !== wsId) {
    return new NextResponse("Sign in to download this file.", { status: 401 });
  }

  const actor = await getSessionActor();
  const membership = actor ? await findMembership(actor.db, actor.userId) : null;
  const studentOfWs = membership?.workspaceId === wsId;
  const isStaff = actor?.kind === "staff";

  // Members and staff: full access (ignore supervisor ?t= so viewers are not blocked).
  if (studentOfWs || isStaff) {
    return fileResponse(wsId, id, request.nextUrl.searchParams.get("inline") === "1");
  }

  const supervisorAccess =
    Boolean(token) ||
    actor?.kind === "supervisor" ||
    (actor
      ? await supervisorCanAccessWorkspace(actor.db, actor.userId, actor.email, wsId)
      : false);

  if (!supervisorAccess) {
    return new NextResponse("Sign in to download this file.", { status: 401 });
  }

  // Supervisors only get review documents explicitly shared with them — never general Project files.
  if (!file.document_id) {
    return new NextResponse("Not shared.", { status: 403 });
  }
  const { data: doc } = await db
    .from("portal_documents")
    .select("shared_with_supervisor")
    .eq("id", file.document_id)
    .eq("workspace_id", wsId)
    .maybeSingle();
  if (!doc?.shared_with_supervisor) return new NextResponse("Not shared.", { status: 403 });

  return fileResponse(wsId, id, request.nextUrl.searchParams.get("inline") === "1");
}
