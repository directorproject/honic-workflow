import { Suspense } from "react";

import { DocumentPacksBoard } from "@/components/portal/document-packs-board";
import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Plans & access · Honic Nexis" };

export default async function DocumentPacksPage() {
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();
  const guest = !user;

  if (user && !state.isStaff && (!profile || state.profileAcademicPending)) {
    return (
      <ProfileForm
        courses={state.courses}
        profile={profile}
        suggestedName={user.suggestedName}
        academicStepPending={state.profileAcademicPending}
      />
    );
  }

  const membership = db && user && !state.isStaff ? await findMembership(db, user.id) : null;
  const viewerDetail = guest
    ? "Preview · sign in to buy a plan"
    : state.isStaff
      ? "Staff · plans overview"
      : [profile?.courseOther ?? profile?.courseCode, studyLevelLabel(profile?.studyLevel ?? null, profile?.studyLevelOther), profile?.institution]
          .filter(Boolean)
          .join(" · ") || user!.email;

  const planActive = !guest && hasActiveDeskPlan(profile?.deskExpiresAt);
  const planLabel = guest
    ? "Preview · create an account to activate"
    : planActive
      ? `Active · ${
          profile?.deskPlan === "semester"
            ? "Semester"
            : profile?.deskPlan === "monthly"
              ? "Monthly"
              : "Full year"
        } · until ${formatShort(profile?.deskExpiresAt)}`
      : "Free plan · pay to hide and make yours";

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        guest={guest}
        viewer={{ name: guest ? "Guest" : profile?.fullName || user!.email, detail: viewerDetail }}
        hasWorkspace={Boolean(membership)}
        hasProgress={Boolean(profile?.trackedProjectId)}
        deskExpiresAt={profile?.deskExpiresAt ?? null}
      >
        <DocumentPacksBoard
          signedIn={!guest}
          planActive={planActive}
          planLabel={planLabel}
          phone={profile?.phone ?? ""}
          deskExpiresAt={profile?.deskExpiresAt ?? null}
          deskPlan={profile?.deskPlan ?? null}
        />
      </PortalShell>
    </Suspense>
  );
}

function formatShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
