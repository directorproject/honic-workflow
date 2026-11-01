import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { getSessionActor } from "@/lib/workspace/access";
import { loadWorkspaceBundle } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Student workspace · Honic" };

export default async function StudentWorkspacePage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const db = getSupabaseAdminClient();
  const actor = await getSessionActor();
  if (!db || actor?.kind !== "staff" || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const bundle = await loadWorkspaceBundle(db, id);
  if (!bundle) notFound();

  return (
    <DashboardShell
      title={bundle.workspace.name}
      subtitle={bundle.members.map((m) => m.full_name).join(", ")}
      statusDotClass="bg-emerald-500"
      headerBelow={
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/students" className="text-dash-accent font-semibold">
            ← All student workspaces
          </Link>
          {bundle.trackedProjectId ? (
            <Link href={`/projects/${bundle.trackedProjectId}`} className="text-dash-muted-foreground hover:text-dash-foreground font-semibold">
              Linked Honic project →
            </Link>
          ) : null}
        </div>
      }
    >
      <WorkspaceView
        bundle={bundle}
        viewer={{ kind: "staff", userId: actor.userId, name: actor.name, canEdit: true }}
        tab={sp.tab ?? "home"}
        basePath={`/students/${id}`}
        printBase={`/students/${id}/print`}
        exportBase={`/api/workspace/${id}/export`}
        fileBase="/api/workspace/files"
      />
    </DashboardShell>
  );
}
