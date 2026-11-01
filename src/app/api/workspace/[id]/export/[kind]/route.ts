import { NextResponse } from "next/server";

import { exportResponse, readableWorkspaceId } from "@/lib/workspace/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff export (inova host). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await ctx.params;
  const workspaceId = await readableWorkspaceId({ workspaceId: id, staffOnly: true });
  if (!workspaceId) return new NextResponse("Staff only.", { status: 401 });
  return exportResponse(workspaceId, kind);
}
