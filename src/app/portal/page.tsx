import Link from "next/link";

import { portalSignOutAction } from "@/app/portal/actions";
import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { MyTitleCard } from "@/components/portal/my-title-card";
import { PortalAuth } from "@/components/portal/portal-auth";
import { ProfileForm } from "@/components/portal/profile-form";
import { TitlePicker } from "@/components/portal/title-picker";
import { ProjectShareView } from "@/components/share/project-share-view";
import { loadPortalState } from "@/lib/portal/data";
import { createProjectShareLink } from "@/lib/project-share";
import { loadProjectDetail } from "@/lib/projects-data";
import { shareLinkPathClientSlug } from "@/lib/share-link-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Student portal · Honic Company Limited",
};

export default async function PortalPage(props: {
  searchParams?: Promise<{ tab?: string; edit?: string; auth_error?: string; notice?: string }>;
}) {
  const sp = props.searchParams ? await props.searchParams : {};
  const state = await loadPortalState();
  const { user, profile } = state;
  const linked = Boolean(profile?.trackedProjectId);
  const tab = linked && sp.tab !== "title" ? "project" : "title";

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
          <a className="text-dash-accent font-semibold" href="https://inova.honiccompany.com">
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
  } else if (tab === "project" && profile.trackedProjectId) {
    content = await renderMyProject(profile.trackedProjectId);
  } else if (state.myTitle) {
    content = <MyTitleCard title={state.myTitle} phone={profile.phone} projectStarted={linked} />;
  } else {
    content = (
      <TitlePicker
        titles={state.availableTitles}
        courseCode={profile.courseOther ?? profile.courseCode}
        hasCredit={state.hasSelectedBefore && profile.changeCredits > 0}
      />
    );
  }

  const tabClass = (active: boolean) =>
    active
      ? "bg-dash-accent rounded-full px-4 py-1.5 text-sm font-semibold text-white"
      : "border-dash-border bg-dash-card text-dash-muted-foreground hover:bg-dash-muted rounded-full border px-4 py-1.5 text-sm font-semibold";

  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className={`mx-auto w-full px-4 py-8 sm:px-6 ${tab === "project" ? "max-w-6xl" : "max-w-3xl"}`}>
        {user && !state.isStaff ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="text-dash-foreground font-semibold">{profile?.fullName ?? user.email}</p>
              {profile ? (
                <p className="text-dash-muted-foreground">
                  {[profile.regNo, profile.courseOther ?? profile.courseCode, user.email].filter(Boolean).join(" · ")}
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

        {linked && profile && sp.edit !== "1" ? (
          <nav className="mb-6 flex gap-2" aria-label="Portal sections">
            <Link href="/portal?tab=project" className={tabClass(tab === "project")}>
              My project
            </Link>
            <Link href="/portal?tab=title" className={tabClass(tab === "title")}>
              My title
            </Link>
          </nav>
        ) : null}

        {content}
      </div>
    </main>
  );
}

async function renderMyProject(projectId: string) {
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
      badge="Your project"
    />
  );
}
