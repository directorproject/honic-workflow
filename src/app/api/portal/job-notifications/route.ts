import { NextResponse } from "next/server";

import { getPortalUser } from "@/lib/portal/data";
import {
  countUnreadJobNotifications,
  listJobNotifications,
  markJobNotificationsRead,
} from "@/lib/portal/job-notifications";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ unread: 0, items: [] }, { status: 401 });
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ unread: 0, items: [] }, { status: 503 });

  const [unread, items] = await Promise.all([
    countUnreadJobNotifications(db, user.id),
    listJobNotifications(db, user.id, 8),
  ]);
  return NextResponse.json(
    { unread, items },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Mark notifications read (all, or for one job). */
export async function POST(req: Request) {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { jobId?: string; all?: boolean };
  await markJobNotificationsRead(db, user.id, {
    jobId: body.jobId ? String(body.jobId) : undefined,
    all: Boolean(body.all),
  });
  const unread = await countUnreadJobNotifications(db, user.id);
  return NextResponse.json({ ok: true, unread });
}
