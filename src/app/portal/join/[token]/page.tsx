import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { PortalAuth } from "@/components/portal/portal-auth";
import { isPortalGoogleSignInEnabled } from "@/lib/portal/google-signin";
import { SiteFooter } from "@/components/portal/site-footer";
import { JoinInvite } from "@/components/workspace/start-workspace";
import { getPortalUser } from "@/lib/portal/data";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Join a project · Honic student portal", robots: { index: false } };

export default async function JoinPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const db = getSupabaseAdminClient();
  const { data: invite } = db
    ? await db.from("portal_workspace_invites").select("email, accepted_at, portal_workspaces(name)").eq("token", token).maybeSingle()
    : { data: null };
  const ws = invite ? ((Array.isArray(invite.portal_workspaces) ? invite.portal_workspaces[0] : invite.portal_workspaces) as { name?: string } | null) : null;
  const user = await getPortalUser();

  let content: React.ReactNode;
  if (!invite || invite.accepted_at) {
    content = (
      <p className="border-dash-border bg-dash-card rounded-2xl border p-5 text-sm">
        This invitation is not valid any more. Ask your partner to send a new one, or <a className="text-dash-accent font-semibold" href="/portal">open the portal</a>.
      </p>
    );
  } else if (!user) {
    content = (
      <div className="space-y-4">
        <p className="border-dash-border bg-dash-card rounded-2xl border p-4 text-sm">
          You are invited to join <strong>{ws?.name ?? "a project"}</strong>. Sign in or create an account with{" "}
          <strong>{String(invite.email)}</strong>, then come back to this link.
        </p>
        <PortalAuth initialStatus={null} googleEnabled={isPortalGoogleSignInEnabled()} />
      </div>
    );
  } else {
    content = <JoinInvite token={token} projectName={ws?.name ?? "the project"} />;
  }

  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{content}</div>
      <SiteFooter />
    </main>
  );
}
