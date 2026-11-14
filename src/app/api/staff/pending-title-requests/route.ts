import { NextResponse } from "next/server";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { countPendingClaims } from "@/lib/portal/title-claims";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getPortalUser();
  if (!user || !isStaffUser(user)) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ count: 0 });
  try {
    const count = await countPendingClaims(db);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
