import Link from "next/link";
import { Suspense } from "react";

import { AuthPageShell } from "@/components/portal/auth-page-shell";
import { PortalShell } from "@/components/portal/portal-shell";
import { SupervisorAuthForm } from "@/components/supervisor/supervisor-auth-form";
import { isPortalGoogleSignInEnabled } from "@/lib/portal/google-signin";
import { getSessionActor, workspacesForSupervisorEmail } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Supervisor portal", robots: { index: false, follow: false } };

export default async function SupervisorPortalPage(props: {
  searchParams: Promise<{ auth?: string; notice?: string; email?: string; project?: string }>;
}) {
  const sp = await props.searchParams;
  const actor = await getSessionActor();
  const prefillEmail = typeof sp.email === "string" ? sp.email.trim().slice(0, 254) : "";
  const projectHint = typeof sp.project === "string" ? sp.project.trim().slice(0, 160) : "";

  if (actor) {
    const projects = await workspacesForSupervisorEmail(actor.db, actor.email);
    const isSupervisorAccount = actor.kind === "supervisor" || projects.length > 0;

    if (isSupervisorAccount) {
      return (
        <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
          <PortalShell
            mode="supervisor"
            hasWorkspace={false}
            viewer={{
              name: actor.name,
              detail: `${actor.email} · ${projects.length} project${projects.length === 1 ? "" : "s"}`,
            }}
          >
            <div className="space-y-5">
              <div className="border-dash-border bg-dash-card rounded-md border px-4 py-4 sm:px-5">
                <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Supervisor</p>
                <h2 className="text-dash-foreground mt-1 text-xl font-semibold tracking-tight">My projects</h2>
                <p className="text-dash-muted-foreground mt-1 text-sm">
                  Projects that list your email under Team & supervisor. Open one to review shared documents, plans, and
                  progress.
                </p>
              </div>

              {!projects.length ? (
                <div className="border-dash-border bg-dash-card rounded-md border p-5 text-sm">
                  <p className="text-dash-foreground font-semibold">No projects yet</p>
                  <p className="text-dash-muted-foreground mt-1">
                    Ask the student to save your email under Team & supervisor, then mark Review items as Shared.
                  </p>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/supervisor/p/${p.id}?tab=home`}
                        className="border-dash-border bg-dash-card hover:border-dash-accent/40 block h-full rounded-md border px-4 py-4 transition-colors"
                      >
                        <p className="text-dash-foreground font-semibold">{p.name}</p>
                        <p className="text-dash-muted-foreground mt-1 text-xs">
                          {p.supervisor_name ? `${p.supervisor_name} · ` : ""}Open workspace →
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PortalShell>
        </Suspense>
      );
    }
  }

  return (
    <AuthPageShell>
      <div className="mx-auto w-full max-w-5xl">
        {sp.notice === "check_email" ? (
          <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Check your email to confirm, then sign in.
          </p>
        ) : null}
        <SupervisorAuthForm
          initialMode={sp.auth === "signup" ? "signup" : prefillEmail ? "signup" : "signin"}
          prefillEmail={prefillEmail}
          projectHint={projectHint}
          googleEnabled={isPortalGoogleSignInEnabled()}
        />
      </div>
    </AuthPageShell>
  );
}
