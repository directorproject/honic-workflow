import Link from "next/link";

import { portalSignOutAction } from "@/app/portal/auth-actions";
import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { CohortTitleBoard } from "@/components/portal/cohort-title-board";
import { PortalAuth } from "@/components/portal/portal-auth";
import { ProfileForm } from "@/components/portal/profile-form";
import { SiteFooter } from "@/components/portal/site-footer";
import { TitleTermsGate } from "@/components/portal/title-terms-gate";
import { studyLevelLabel } from "@/lib/portal/config";
import { isPortalGoogleSignInEnabled } from "@/lib/portal/google-signin";
import { loadPortalState } from "@/lib/portal/data";

import { loadLiterature } from "@/lib/portal/title-choices";

import { titleTermsStatus } from "@/lib/portal/title-terms";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";
import { formatDate } from "@/lib/workspace/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Literature review · Honic Company Limited" };

export default async function PortalTitlesPage() {
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();

  let content: React.ReactNode;
  let catalogue = false;
  if (!user) {
    content = <PortalAuth initialStatus={null} googleEnabled={isPortalGoogleSignInEnabled()} />;
  } else if (state.isStaff && db) {
    const review = await loadLiterature(db, null, null);
    catalogue = true;
    content = (
      <CohortTitleBoard
        items={review.items}
        mine={[]}
        courses={state.courses}
        studentYear={null}
        readOnly
        viewer={{ name: user.email, detail: "Staff · reading only", homeHref: null }}
      />
    );
  } else if (!profile || !db) {
    content = <ProfileForm courses={state.courses} profile={profile} suggestedName={user.suggestedName} />;
  } else {
    const account = await db.auth.admin.getUserById(user.id);
    if (account.error) throw new Error(account.error.message);
    const terms = titleTermsStatus(account.data.user?.user_metadata);
    if (!terms.accepted) {
      content = <TitleTermsGate step={terms.policyAccepted ? "rules" : "policy"} />;
    } else {
      const [review, membership] = await Promise.all([loadLiterature(db, user.id, profile), findMembership(db, user.id)]);
      catalogue = true;
      content = (
        <CohortTitleBoard
          items={review.items}
          mine={review.mine}
          courses={state.courses}
          studentYear={profile.academicYear}
          acceptedOn={formatDate(terms.acceptedAt)}
          readOnly={false}
          hasWorkspace={Boolean(membership)}
          hasProgress={Boolean(profile.trackedProjectId)}
          deskExpiresAt={profile.deskExpiresAt}
          viewer={{
            name: profile.fullName || user.email,
            detail: [profile.courseOther ?? profile.courseCode, studyLevelLabel(profile.studyLevel, profile.studyLevelOther), profile.institution].filter(Boolean).join(" · ") || null,
            homeHref: "/portal",
          }}
        />
      );
    }
  }

  if (catalogue) return content;

  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {user && !state.isStaff ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="text-dash-foreground font-semibold">{profile?.fullName ?? user.email}</p>
              {profile ? (
                <p className="text-dash-muted-foreground">
                  {[profile.courseOther ?? profile.courseCode, studyLevelLabel(profile.studyLevel, profile.studyLevelOther), profile.institution].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/portal" className="text-dash-accent font-semibold">
                Portal home
              </Link>
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
      <SiteFooter />
    </main>
  );
}
