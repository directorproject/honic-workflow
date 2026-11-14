import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { PortalShell } from "@/components/portal/portal-shell";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { getSessionActor, supervisorCanAccessWorkspace } from "@/lib/workspace/access";
import { loadWorkspaceBundle } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Project · Supervisor", robots: { index: false, follow: false } };

export default async function SupervisorProjectPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const actor = await getSessionActor();
  if (!actor) redirect("/supervisor");

  const allowed = await supervisorCanAccessWorkspace(actor.db, actor.userId, actor.email, id);
  if (!allowed) notFound();

  const bundle = await loadWorkspaceBundle(actor.db, id, { supervisorView: true });
  if (!bundle) notFound();

  const basePath = `/supervisor/p/${id}`;
  const members = bundle.members.map((m) => m.full_name).filter(Boolean).join(", ");
  const sharedCount = bundle.documents.filter((d) => d.shared_with_supervisor).length;

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        mode="supervisor"
        hasWorkspace
        workspaceBase={basePath}
        viewer={{
          name: actor.name,
          detail: [bundle.workspace.name, members || null, `${sharedCount} shared`].filter(Boolean).join(" · "),
        }}
      >
        <div className="mb-4 rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-violet-950 dark:text-violet-100">Supervisor view</p>
          <p className="text-violet-900/80 dark:text-violet-100/80 mt-0.5 text-xs sm:text-sm">
            Same workspace layout as the student. Editing, payments, help desk, and team invites are hidden. You can comment on
            shared Review documents.
          </p>
        </div>
        <WorkspaceView
          bundle={bundle}
          viewer={{
            kind: "supervisor",
            userId: actor.userId,
            name: actor.name,
            canEdit: false,
          }}
          tab={sp.tab ?? "home"}
          basePath={basePath}
          printBase="/portal/print"
          exportBase="/api/portal/export"
          fileBase="/api/portal/files"
          hideNav
        />
      </PortalShell>
    </Suspense>
  );
}
