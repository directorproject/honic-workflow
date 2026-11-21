import { NextResponse } from "next/server";

import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { fetchLinkClickStats, fetchTopTitleClicks } from "@/lib/portal/link-clicks";
import { fetchVisitSummary } from "@/lib/portal/page-visits";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getPortalUser();
  if (!user || !isStaffUser(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const [links, titles, visits] = await Promise.all([
      fetchLinkClickStats(db),
      fetchTopTitleClicks(db, 80),
      fetchVisitSummary(db, 30),
    ]);
    return NextResponse.json({
      links,
      titles,
      visits,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load analytics." },
      { status: 500 },
    );
  }
}
