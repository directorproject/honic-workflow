import { TitleClaimReviewList } from "@/components/titles/title-claim-review-list";
import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { evidenceForClaims, pendingClaims } from "@/lib/portal/title-claims";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";

export async function TitleClaimQueue() {
  const user = await getPortalUser();
  if (!isStaffUser(user)) return null;
  const db = getSupabaseServiceRoleClient();
  if (!db) return null;
  const waiting = await pendingClaims(db);
  if (!waiting.length) return null;

  const evidence = await evidenceForClaims(
    db,
    waiting.map((c) => c.id),
  );
  const evidenceByClaim = new Map<string, typeof evidence>();
  for (const row of evidence) {
    const list = evidenceByClaim.get(row.claimId) ?? [];
    list.push(row);
    evidenceByClaim.set(row.claimId, list);
  }

  const signedUrls = new Map<string, string>();
  for (const row of evidence) {
    if (row.publicId) signedUrls.set(row.id, `/api/staff/claim-evidence/${encodeURIComponent(row.publicId)}`);
  }

  return (
    <section className="border-dash-border bg-dash-card mb-8 rounded-2xl border p-4">
      <h2 className="text-dash-foreground text-base font-semibold">Ownership claims to review</h2>
      <p className="text-dash-muted-foreground mt-1 mb-4 text-sm">
        Check project files and either proof uploads or question answers. Confirming an appeal replaces the previous owner.
      </p>
      <TitleClaimReviewList claims={waiting} evidenceByClaim={evidenceByClaim} signedUrls={signedUrls} />
    </section>
  );
}
