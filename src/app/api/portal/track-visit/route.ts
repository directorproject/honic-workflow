import { NextResponse, type NextRequest } from "next/server";

import { recordPageVisit } from "@/lib/portal/page-visits";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { getSessionActor } from "@/lib/workspace/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  path?: unknown;
  sessionKey?: unknown;
};

export async function POST(request: NextRequest) {
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });

  let body: Body = {};
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      body = (await request.json()) as Body;
    } else {
      const text = await request.text();
      body = text ? (JSON.parse(text) as Body) : {};
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const path = typeof body.path === "string" ? body.path : "";
  if (!path) return NextResponse.json({ ok: false, error: "path required" }, { status: 400 });

  const actor = await getSessionActor();
  await recordPageVisit(db, {
    path,
    sessionKey: typeof body.sessionKey === "string" ? body.sessionKey : null,
    viewerId: actor?.userId ?? null,
  });

  return NextResponse.json({ ok: true });
}
