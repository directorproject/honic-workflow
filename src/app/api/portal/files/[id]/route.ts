import { NextResponse, type NextRequest } from "next/server";

import { fileResponse, readableWorkspaceId } from "@/lib/workspace/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = request.nextUrl.searchParams.get("t");
  const workspaceId = await readableWorkspaceId({ token });
  if (!workspaceId) return new NextResponse("Sign in to download this file.", { status: 401 });
  return fileResponse(workspaceId, id, request.nextUrl.searchParams.get("inline") === "1");
}
