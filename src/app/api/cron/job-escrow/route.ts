import { NextResponse, type NextRequest } from "next/server";

import { sweepPeerHelpEscrows } from "@/lib/portal/job-escrow";
import { purgeExpiredPeerHelpMessages } from "@/lib/portal/jobs";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Hourly: escrow timers + clear finished peer-help chats after 96h. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });

  try {
    const escrow = await sweepPeerHelpEscrows(db);
    const chat = await purgeExpiredPeerHelpMessages(db);
    return NextResponse.json({ ok: true, ...escrow, chat });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sweep failed" },
      { status: 500 },
    );
  }
}
