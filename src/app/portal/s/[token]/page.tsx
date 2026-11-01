import { notFound } from "next/navigation";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { loadWorkspaceBundle } from "@/lib/workspace/load";
import { workspaceIdForSupervisorToken } from "@/lib/workspace/resolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Student project · Honic Company Limited", robots: { index: false, follow: false } };

export default async function SupervisorPage(props: { params: Promise<{ token: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ token }, sp] = await Promise.all([props.params, props.searchParams]);
  const workspaceId = await workspaceIdForSupervisorToken(token);
  const db = getSupabaseAdminClient();
  const bundle = workspaceId && db ? await loadWorkspaceBundle(db, workspaceId) : null;
  if (!bundle) notFound();

  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="border-dash-border bg-dash-card mb-6 rounded-2xl border px-4 py-3 text-sm">
          <p className="text-dash-foreground font-semibold">Supervisor view (read only)</p>
          <p className="text-dash-muted-foreground">
            {bundle.members.map((m) => m.full_name).join(", ")} shared their project with you. You can leave comments on documents and
            logbook entries; the students get an alert.
          </p>
        </div>
        <WorkspaceView
          bundle={bundle}
          viewer={{ kind: "supervisor", userId: null, name: bundle.workspace.supervisor_name ?? "Supervisor", canEdit: false }}
          tab={sp.tab ?? "home"}
          basePath={`/portal/s/${token}`}
          printBase="/portal/print"
          exportBase="/api/portal/export"
          fileBase="/api/portal/files"
          supervisorToken={token}
        />
      </div>
    </main>
  );
}
