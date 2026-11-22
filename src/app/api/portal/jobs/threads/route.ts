import { NextResponse, type NextRequest } from "next/server";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { getJobByPublicId, listChatThreads } from "@/lib/portal/jobs";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Peer-help inbox: chat list with last message and incoming times (for unread badges). */
export async function GET(request: NextRequest) {
  const user = await getPortalUser();
  if (!user || isStaffUser(user)) {
    return NextResponse.json({ ok: false, threads: [] }, { status: 401 });
  }
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, threads: [] }, { status: 503 });

  const jobPublicId = String(request.nextUrl.searchParams.get("jobPublicId") ?? "");
  let jobId: string | undefined;
  if (jobPublicId) {
    const job = await getJobByPublicId(db, jobPublicId, user.id);
    if (!job) return NextResponse.json({ ok: true, threads: [] });
    jobId = job.id;
  }

  const threads = await listChatThreads(db, user.id, { jobId });
  return NextResponse.json({ ok: true, threads }, { headers: { "Cache-Control": "no-store" } });
}
