import Link from "next/link";

import { portalSignOutAction } from "@/app/portal/actions";
import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { MyTitleCard } from "@/components/portal/my-title-card";
import { PortalAuth } from "@/components/portal/portal-auth";
import { ProfileForm } from "@/components/portal/profile-form";
import { TitlePicker } from "@/components/portal/title-picker";
import { ProjectShareView } from "@/components/share/project-share-view";
import { StartWorkspace } from "@/components/workspace/start-workspace";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { loadPortalState, type PortalState } from "@/lib/portal/data";
import { createProjectShareLink } from "@/lib/project-share";
import { loadProjectDetail } from "@/lib/projects-data";
import { shareLinkPathClientSlug } from "@/lib/share-link-origin";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";
import { loadWorkspaceBundle } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Student portal · Honic Company Limited",
  manifest: "/portal.webmanifest",
  appleWebApp: { capable: true, title: "Honic portal", statusBarStyle: "default" as const },
};

export default async function PortalPage(props: {
  searchParams?: Promise<{ tab?: string; edit?: string; auth_error?: string; notice?: string }>;
}) {
  const sp = props.searchParams ? await props.searchParams : {};
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();
  let wide = false;

  let content: React.ReactNode;
  if (!user) {
    const notices: Record<string, { ok: boolean; message: string }> = {
      confirmed: { ok: true, message: "Your email is confirmed. Sign in to continue." },
      reset_other_device: {
        ok: false,
        message: "Open the password reset link on the same phone or computer where you asked for it, or request a new link.",
      },
    };
    const initial = sp.notice && notices[sp.notice]
      ? notices[sp.notice]
      : sp.auth_error
        ? { ok: false, message: "That link is invalid or has expired. Please try again." }
        : null;
    content = <PortalAuth initialStatus={initial} googleEnabled={process.env.PORTAL_GOOGLE_SIGNIN === "true"} />;
  } else if (state.isStaff) {
    content = (
      <div className="border-dash-border bg-dash-card flex flex-wrap items-center gap-3 rounded-2xl border p-5 text-sm">
        <p>
          This is a staff account. Staff use{" "}
          <a className="text-dash-accent font-semibold" href="https://inova.honiccompany.com/students">
            inova.honiccompany.com
          </a>
          .
        </p>
        <form action={portalSignOutAction} className="ml-auto">
          <button type="submit" className="text-dash-accent font-semibold">
            Sign out
          </button>
        </form>
      </div>
    );
  } else if (!profile || sp.edit === "1") {
    content = (
      <ProfileForm
        courses={state.courses}
        profile={profile}
        cancelHref={profile ? "/portal" : undefined}
        suggestedName={user.suggestedName}
      />
    );
  } else {
    const membership = db ? await findMembership(db, user.id) : null;
    const bundle = membership && db ? await loadWorkspaceBundle(db, membership.workspaceId) : null;
    const linked = Boolean(profile.trackedProjectId);

    if (bundle) {
      wide = true;
      const tab = sp.tab ?? "home";
      content = (
        <WorkspaceView
          bundle={bundle}
          viewer={{ kind: "student", userId: user.id, name: profile.fullName, canEdit: true }}
          tab={tab}
          basePath="/portal"
          printBase="/portal/print"
          exportBase="/api/portal/export"
          fileBase="/api/portal/files"
          extra={{
            title: titleSection(state, linked),
            progress: linked ? (tab === "progress" ? await renderHonicProgress(profile.trackedProjectId!) : <span />) : undefined,
          }}
        />
      );
    } else {
      wide = sp.tab === "progress" && linked;
      const invites = db ? await loadInvitesFor(db, user.email) : [];
      content =
        sp.tab === "progress" && linked ? (
          await renderHonicProgress(profile.trackedProjectId!)
        ) : (
          <div className="space-y-6">
            {linked ? (
              <Link
                href="/portal?tab=progress"
                className="border-dash-border bg-dash-card block rounded-2xl border px-4 py-3 text-sm font-semibold"
              >
                Honic has started your project. See Honic progress →
              </Link>
            ) : null}
            <StartWorkspace suggestedName={state.myTitle?.title ?? ""} category={profile.projectCategory} invites={invites} />
            <div>
              <h2 className="text-dash-foreground mb-3 text-base font-semibold">Project title</h2>
              {titleSection(state, linked)}
            </div>
          </div>
        );
    }
  }

  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className={`mx-auto w-full px-4 py-6 sm:px-6 ${wide ? "max-w-7xl" : "max-w-3xl"}`}>
        {user && !state.isStaff ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="text-dash-foreground font-semibold">{profile?.fullName ?? user.email}</p>
              {profile ? (
                <p className="text-dash-muted-foreground">
                  {[profile.courseOther ?? profile.courseCode, profile.institution, user.email].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3 text-sm">
              {profile && sp.edit !== "1" ? (
                <Link href="/portal?edit=1" className="text-dash-accent font-semibold">
                  Edit details
                </Link>
              ) : null}
              <form action={portalSignOutAction}>
                <button type="submit" className="text-dash-muted-foreground hover:text-dash-foreground font-semibold">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        ) : null}
        {content}
      </div>
    </main>
  );
}

function titleSection(state: PortalState, linked: boolean) {
  const { profile } = state;
  if (!profile) return null;
  if (state.myTitle) return <MyTitleCard title={state.myTitle} phone={profile.phone} projectStarted={linked} />;
  return <TitlePicker titles={state.availableTitles} courses={state.courses} hasCredit={state.hasSelectedBefore && profile.changeCredits > 0} />;
}

async function loadInvitesFor(db: NonNullable<ReturnType<typeof getSupabaseAdminClient>>, email: string) {
  if (!email) return [];
  const { data } = await db
    .from("portal_workspace_invites")
    .select("token, invited_by, portal_workspaces(name)")
    .ilike("email", email)
    .is("accepted_at", null);
  const rows = data ?? [];
  const inviterIds = [...new Set(rows.map((r) => r.invited_by).filter(Boolean))] as string[];
  const { data: names } = inviterIds.length
    ? await db.from("student_profiles").select("user_id, full_name").in("user_id", inviterIds)
    : { data: [] as { user_id: string; full_name: string }[] };
  return rows.map((r) => {
    const ws = (Array.isArray(r.portal_workspaces) ? r.portal_workspaces[0] : r.portal_workspaces) as { name?: string } | null;
    return {
      token: String(r.token),
      projectName: String(ws?.name ?? "A project"),
      invitedBy: String((names ?? []).find((n) => n.user_id === r.invited_by)?.full_name ?? "Your partner"),
    };
  });
}

async function renderHonicProgress(projectId: string) {
  const { project, error } = await loadProjectDetail(projectId, { includeRegisteredClientContact: false });
  if (!project) {
    return <p className="text-dash-muted-foreground text-sm">Your project is not available right now. Please try again later.</p>;
  }
  let link = await createProjectShareLink({ trackedProjectId: project.id });
  if (!link.ok) link = await createProjectShareLink({ trackedProjectId: project.id });
  if (!link.ok) {
    return <p className="text-dash-muted-foreground text-sm">Your project is not available right now. Please try again later.</p>;
  }
  return (
    <ProjectShareView
      project={project}
      error={error}
      slug={shareLinkPathClientSlug(project.registered_clients)}
      token={link.token}
      badge="Honic progress"
    />
  );
}
