import { TitleClaimReviewList } from "@/components/titles/title-claim-review-list";
import { claimsForUser, evidenceForClaims } from "@/lib/portal/title-claims";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";

export async function UserOwnershipClaims({
  userId,
  publicId,
}: {
  userId: string;
  publicId: string;
}) {
  const db = getSupabaseServiceRoleClient();
  if (!db) return null;

  const claims = await claimsForUser(db, userId);
  const evidence = await evidenceForClaims(
    db,
    claims.map((c) => c.id),
  );
  const evidenceByClaim = new Map<string, typeof evidence>();
  for (const row of evidence) {
    const list = evidenceByClaim.get(row.claimId) ?? [];
    list.push(row);
    evidenceByClaim.set(row.claimId, list);
  }

  // Staff-only proxy URLs — never embed raw storage signed URLs in HTML.
  const signedUrls = new Map<string, string>();
  for (const row of evidence) {
    if (row.publicId) signedUrls.set(row.id, `/api/staff/claim-evidence/${encodeURIComponent(row.publicId)}`);
  }

  const pending = claims.filter((c) => c.status === "pending").length;

  return (
    <section className="border-dash-border bg-dash-card rounded-2xl border p-4 shadow-sm">
      <h2 className="text-dash-foreground text-sm font-semibold">Ownership claims and proof</h2>
      <p className="text-dash-muted-foreground mt-1 mb-4 text-xs">
        Claims, appeals, project documents, and ownership proof submitted by this student.
        {pending ? ` ${pending} waiting for review.` : ""}
      </p>
      <TitleClaimReviewList
        claims={claims}
        evidenceByClaim={evidenceByClaim}
        signedUrls={signedUrls}
        requesterPublicId={publicId}
      />
    </section>
  );
}
