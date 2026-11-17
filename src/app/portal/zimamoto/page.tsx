import { Suspense } from "react";

import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { ZimamotoBoard } from "@/components/portal/zimamoto-board";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import { listPublicZimamotoPosts, listZimamotoGroups } from "@/lib/portal/zimamoto";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Zimamoto · Honic Nexis" };

export default async function ZimamotoPage() {
  const state = await loadPortalState();
  const { user, profile } = state;
  const db = getSupabaseAdminClient();
  const guest = !user;

  if (user && !state.isStaff && !profile) {
    return (
      <main className="bg-dash-canvas text-dash-foreground mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <ProfileForm courses={state.courses} profile={profile} suggestedName={user.suggestedName} />
      </main>
    );
  }

  const [membership, publicPosts, groups] = await Promise.all([
    db && user && !state.isStaff ? findMembership(db, user.id) : Promise.resolve(null),
    db ? listPublicZimamotoPosts(db, user?.id ?? null) : Promise.resolve([]),
    db && user && !guest ? listZimamotoGroups(db, user.id) : Promise.resolve([]),
  ]);

  const viewerDetail = guest
    ? "Preview · sign in to post and join groups"
    : state.isStaff
      ? "Staff · Zimamoto overview"
      : [profile?.courseOther ?? profile?.courseCode, studyLevelLabel(profile?.studyLevel ?? null, profile?.studyLevelOther), profile?.institution]
          .filter(Boolean)
          .join(" · ") || user!.email;

  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" />}>
      <PortalShell
        guest={guest}
        viewer={{ name: guest ? "Guest" : profile?.fullName || user!.email, detail: viewerDetail }}
        hasWorkspace={Boolean(membership)}
        hasProgress={Boolean(profile?.trackedProjectId)}
        deskExpiresAt={profile?.deskExpiresAt ?? null}
      >
        <ZimamotoBoard guest={guest} publicPosts={publicPosts} groups={groups} />
      </PortalShell>
    </Suspense>
  );
}