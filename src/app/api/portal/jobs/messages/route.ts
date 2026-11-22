import { NextResponse, type NextRequest } from "next/server";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import {
  listMessagesSinceForApplicationPublicId,
  postJobMessage,
} from "@/lib/portal/jobs";
import { peerHelpAccepted, peerHelpRulesError } from "@/lib/portal/jobs-peer-help";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fast chat poll — avoids Next.js server-action UI blocking. */
export async function GET(request: NextRequest) {
  const user = await getPortalUser();
  if (!user || isStaffUser(user)) {
    return NextResponse.json({ ok: false, messages: [] }, { status: 401 });
  }
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, messages: [] }, { status: 503 });

  const applicationPublicId = String(request.nextUrl.searchParams.get("applicationPublicId") ?? "");
  const sinceIso = String(request.nextUrl.searchParams.get("sinceIso") ?? new Date(0).toISOString());
  if (!applicationPublicId) {
    return NextResponse.json({ ok: false, messages: [] }, { status: 400 });
  }

  const res = await listMessagesSinceForApplicationPublicId(db, applicationPublicId, user.id, sinceIso);
  if (!res) return NextResponse.json({ ok: true, messages: [] });
  return NextResponse.json(
    { ok: true, applicationId: res.applicationId, messages: res.messages },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Fast chat send — fetch API so the client UI never waits on a server action. */
export async function POST(request: NextRequest) {
  const user = await getPortalUser();
  if (!user || isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Please sign in again." }, { status: 401 });
  }
  if (!peerHelpAccepted(user)) {
    return NextResponse.json({ ok: false, message: peerHelpRulesError() }, { status: 403 });
  }
  const db = getSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Service unavailable." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    applicationPublicId?: string;
    body?: string;
  };
  const result = await postJobMessage(db, {
    userId: user.id,
    applicationPublicId: String(body.applicationPublicId ?? ""),
    body: String(body.body ?? ""),
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, chat: result.chat });
}
