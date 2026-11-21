import { NextResponse, type NextRequest } from "next/server";

import { recordLinkClick } from "@/lib/portal/link-clicks";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { getSessionActor } from "@/lib/workspace/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  linkKey?: unknown;
  label?: unknown;
  href?: unknown;
  sourcePath?: unknown;
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

  const linkKey = typeof body.linkKey === "string" ? body.linkKey.trim() : "";
  if (!linkKey) return NextResponse.json({ ok: false, error: "linkKey required" }, { status: 400 });

  const actor = await getSessionActor();
  await recordLinkClick(db, {
    linkKey,
    label: typeof body.label === "string" ? body.label : undefined,
    href: typeof body.href === "string" ? body.href : undefined,
    viewerId: actor?.userId ?? null,
    sourcePath: typeof body.sourcePath === "string" ? body.sourcePath : null,
  });

  return NextResponse.json({ ok: true });
}
