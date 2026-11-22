import Link from "next/link";
import { after } from "next/server";

import { portalSignOutAction } from "@/app/portal/auth-actions";
import { NexisBrandBar } from "@/components/brand/nexis-brand-bar";
import { CohortTitleBoard } from "@/components/portal/cohort-title-board";
import { ProfileForm } from "@/components/portal/profile-form";
import { SiteFooter } from "@/components/portal/site-footer";
import { TitleTermsGate } from "@/components/portal/title-terms-gate";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import { loadGuestLiteratureCatalogue, loadStudentLiteratureCatalogue } from "@/lib/portal/literature-guest-cache";
import { recordPageVisit } from "@/lib/portal/page-visits";
import { GUEST_TITLE_PREVIEW_LIMIT } from "@/lib/portal/title-limits";
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

  // Server-side visit so analytics sees /portal/titles even when the browser beacon misses.
  if (db) {
    after(() => {
      void recordPageVisit(db, {
        path: "/portal/titles",
        sessionKey: null,
        viewerId: user?.id ?? null,
      });
    });
  }

  let content: React.ReactNode;
  let catalogue = false;
  if (!user && db) {
    const review = await loadGuestLiteratureCatalogue();
    const total = review.items.length;
    const preview = review.items.slice(0, GUEST_TITLE_PREVIEW_LIMIT);
    catalogue = true;
    content = (
      <CohortTitleBoard
        items={preview}
        mine={[]}
        courses={state.courses}
        studentYear={null}
        readOnly
        guest
        guestTotalCount={total}
        viewer={{ name: "Guest", detail: "Preview · sign in to shortlist", homeHref: "/portal/home" }}
      />
    );
  } else if (!user) {
    content = (
      <p className="text-dash-muted-foreground text-sm">
        Literature is not available right now.{" "}
        <Link href="/portal?auth=signin" className="text-dash-accent font-semibold">
          Sign in
        </Link>
      </p>
    );
  } else if (state.isStaff && db) {
    const review = await loadGuestLiteratureCatalogue();
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
  } else if (!db || !profile || state.profileAcademicPending) {
    return (
      <ProfileForm
        courses={state.courses}
        profile={profile}
        suggestedName={user.suggestedName}
        academicStepPending={state.profileAcademicPending}
      />
    );
  } else {
    const terms = state.titleTerms ?? { accepted: false, policyAccepted: false, rulesAccepted: false, acceptedAt: null };
    if (!terms.accepted) {
      content = (
        <TitleTermsGate step={terms.policyAccepted ? "rules" : "policy"} nextHref="/portal/titles" />
      );
    } else {
      const [review, membership] = await Promise.all([
        loadStudentLiteratureCatalogue(user.id, profile),
        findMembership(db, user.id),
      ]);
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
            detail:
              [profile.courseOther ?? profile.courseCode, studyLevelLabel(profile.studyLevel, profile.studyLevelOther), profile.institution]
                .filter(Boolean)
                .join(" · ") || null,
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
        <NexisBrandBar />
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {user && !state.isStaff ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="text-dash-foreground font-semibold">{profile?.fullName ?? user.email}</p>
              {profile ? (
                <p className="text-dash-muted-foreground">
                  {[profile.courseOther ?? profile.courseCode, studyLevelLabel(profile.studyLevel, profile.studyLevelOther), profile.institution]
                    .filter(Boolean)
                    .join(" · ")}
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
