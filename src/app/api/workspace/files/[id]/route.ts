import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { getSessionActor } from "@/lib/workspace/access";
import { fileResponse } from "@/lib/workspace/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff download (inova host). */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getSessionActor();
  const db = getSupabaseAdminClient();
  if (actor?.kind !== "staff" || !db) return new NextResponse("Staff only.", { status: 401 });
  const { data } = await db.from("portal_files").select("workspace_id").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Not found.", { status: 404 });
  return fileResponse(String(data.workspace_id), id, request.nextUrl.searchParams.get("inline") === "1");
}
