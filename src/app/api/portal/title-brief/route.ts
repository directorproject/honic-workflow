import { NextResponse, type NextRequest } from "next/server";

import { loadTitleBriefFields } from "@/lib/portal/title-choices";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lazy brief for literature list expand — keeps the catalogue cache under 2MB. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id || id.length > 200) {
    return NextResponse.json({ ok: false, message: "Missing title id." }, { status: 400 });
  }

  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "Unavailable." }, { status: 503 });

  try {
    const brief = await loadTitleBriefFields(db, id);
    if (!brief) return NextResponse.json({ ok: false, message: "Title not found." }, { status: 404 });
    return NextResponse.json(
      { ok: true, brief },
      { headers: { "Cache-Control": "private, max-age=120" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Could not load brief." },
      { status: 500 },
    );
  }
}
