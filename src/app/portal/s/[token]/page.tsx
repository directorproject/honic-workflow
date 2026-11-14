import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { SiteFooter } from "@/components/portal/site-footer";
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
  const bundle = workspaceId && db ? await loadWorkspaceBundle(db, workspaceId, { supervisorView: true }) : null;
  if (!bundle) notFound();

  const formQs = new URLSearchParams({ auth: "signup" });
  if (bundle.workspace.supervisor_email) formQs.set("email", bundle.workspace.supervisor_email);
  if (bundle.workspace.name) formQs.set("project", bundle.workspace.name);
  const supervisorFormHref = `/supervisor?${formQs.toString()}`;

  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="border-dash-border bg-dash-card mb-6 flex flex-wrap items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm">
          <div>
            <p className="text-dash-foreground font-semibold">Supervisor guest view</p>
            <p className="text-dash-muted-foreground mt-1 max-w-2xl">
              {bundle.members.map((m) => m.full_name).join(", ")} shared review items with you. For a permanent account,
              open the supervisor form.
            </p>
          </div>
          <Link
            href={supervisorFormHref}
            className="bg-dash-accent inline-flex shrink-0 items-center rounded-md px-3.5 py-2 text-sm font-semibold text-white"
          >
            Open supervisor form →
          </Link>
        </div>
        <WorkspaceView
          bundle={bundle}
          viewer={{ kind: "supervisor", userId: null, name: bundle.workspace.supervisor_name ?? "Supervisor", canEdit: false }}
          tab={sp.tab ?? "review"}
          basePath={`/portal/s/${token}`}
          printBase="/portal/print"
          exportBase="/api/portal/export"
          fileBase="/api/portal/files"
          supervisorToken={token}
        />
      </div>
      <SiteFooter />
    </main>
  );
}
