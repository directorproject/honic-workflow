import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DeadlinesManager } from "@/components/workspace/deadlines-manager";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import type { SharedDeadline } from "@/lib/workspace/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Shared deadlines · Honic" };

export default async function DeadlinesPage() {
  const db = getSupabaseAdminClient();
  const [{ data: deadlines }, { data: courses }] = db
    ? await Promise.all([
        db.from("portal_deadlines").select("*").order("due_date"),
        db.from("courses").select("code, name").eq("is_active", true).neq("code", "OTHER").order("sort_order"),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <DashboardShell
      title="Shared deadlines"
      subtitle="University deadlines shown in every matching student's calendar."
      statusDotClass="bg-emerald-500"
      headerBelow={
        <Link href="/students" className="text-dash-accent text-sm font-semibold">
          ← Student workspaces
        </Link>
      }
    >
      <div className="space-y-5">
        <DeadlinesManager deadlines={(deadlines ?? []) as SharedDeadline[]} courses={(courses ?? []).map((c) => ({ code: String(c.code), name: String(c.name) }))} />
      </div>
    </DashboardShell>
  );
}
