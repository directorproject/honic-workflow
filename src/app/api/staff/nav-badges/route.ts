import { NextResponse } from "next/server";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { countPendingClaims } from "@/lib/portal/title-claims";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { countUnreadHelpDesk } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getPortalUser();
  if (!user || !isStaffUser(user)) {
    return NextResponse.json({ pendingTitleRequests: 0, helpDeskUnread: 0 }, { status: 401 });
  }
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ pendingTitleRequests: 0, helpDeskUnread: 0 });
  try {
    const [pendingTitleRequests, helpDeskUnread] = await Promise.all([
      countPendingClaims(db),
      countUnreadHelpDesk(db),
    ]);
    return NextResponse.json({ pendingTitleRequests, helpDeskUnread });
  } catch {
    return NextResponse.json({ pendingTitleRequests: 0, helpDeskUnread: 0 });
  }
}
