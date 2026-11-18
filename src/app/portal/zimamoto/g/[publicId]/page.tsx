import Link from "next/link";
import { Suspense } from "react";

import { PortalShell } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { GroupChat } from "@/components/zimamoto/group-chat";
import { studyLevelLabel } from "@/lib/portal/config";
import { loadPortalState } from "@/lib/portal/data";
import { getZimamotoGroupByPublicId } from "@/lib/portal/zimamoto";
import { listGroupMessages } from "@/lib/portal/zimamoto-chat";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership } from "@/lib/workspace/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Props) {
  const { publicId } = await params;
  return { title: `Zimamoto group · ${publicId.slice(0, 8)}…` };
}

export default async function ZimamotoGroupRoute({ params }: Props) {
  const { publicId } = await params;
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

  if (!db) {
    return (
      <main className="bg-dash-canvas text-dash-muted-foreground min-h-screen p-8 text-sm">Zimamoto is unavailable right now.</main>
    );
  }

  const group = await getZimamotoGroupByPublicId(db, publicId, user?.id ?? null);
  if (!group) {
    return (
      <PortalShell
        guest={guest}
        viewer={{ name: guest ? "Guest" : profile?.fullName || user?.email || "Student", detail: null }}
        hasWorkspace={false}
        deskExpiresAt={profile?.deskExpiresAt ?? null}
      >
        <div className="mx-auto max-w-lg px-4 py-16">
          <p className="text-dash-foreground font-semibold">Group not found or private.</p>
          <Link href="/portal/zimamoto" className="text-dash-accent mt-4 inline-block text-sm font-semibold">
            Back to Zimamoto
          </Link>
        </div>
      </PortalShell>
    );
  }

  const membership = user && !state.isStaff ? await findMembership(db, user.id) : null;
  const initialMessages = group.isMember && user ? await listGroupMessages(db, group.id, user.id) : [];

  const viewerDetail = guest
    ? "Preview"
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
        <GroupChat
          group={{
            id: group.id,
            publicId: group.publicId,
            name: group.name,
            description: group.description,
            isPrivate: group.isPrivate,
            isOwner: group.isOwner,
            isMember: group.isMember && !guest,
            memberCount: group.memberCount,
          }}
          initialMessages={initialMessages}
          viewerName={profile?.fullName || user?.email || "you"}
        />
      </PortalShell>
    </Suspense>
  );
}