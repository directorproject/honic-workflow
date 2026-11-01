import { NextResponse, type NextRequest } from "next/server";

import { exportResponse, readableWorkspaceId } from "@/lib/workspace/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const workspaceId = await readableWorkspaceId({ token: request.nextUrl.searchParams.get("t") });
  if (!workspaceId) return new NextResponse("Sign in first.", { status: 401 });
  return exportResponse(workspaceId, kind);
}
