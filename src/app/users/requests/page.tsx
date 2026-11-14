import Link from "next/link";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { TitleClaimReviewList } from "@/components/titles/title-claim-review-list";
import { requireStaffPage } from "@/lib/portal/accounts";
import { evidenceForClaims, pendingClaims } from "@/lib/portal/title-claims";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Requested titles · Honic" };

export default async function RequestedTitlesPage() {
  const db = await requireStaffPage();
  const pending = await pendingClaims(db);
  const evidence = await evidenceForClaims(
    db,
    pending.map((c) => c.id),
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
    <DashboardShell
      title="Requested titles"
      subtitle="Ownership claims and proof from students. Confirm or reject each request."
      statusDotClass={pending.length ? "bg-amber-500" : "bg-emerald-500"}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-dash-foreground text-sm font-semibold tabular-nums">
          {pending.length} new request{pending.length === 1 ? "" : "s"}
        </p>
        <Link
          href="/users"
          className="border-dash-border bg-dash-card hover:bg-dash-muted inline-flex rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm"
        >
          Back to registered users
        </Link>
      </div>

      <section className="border-dash-border bg-dash-card rounded-2xl border p-4 shadow-sm">
        {pending.length ? (
          <TitleClaimReviewList claims={pending} evidenceByClaim={evidenceByClaim} signedUrls={signedUrls} />
        ) : (
          <p className="text-dash-muted-foreground text-sm">No new title requests right now.</p>
        )}
      </section>
    </DashboardShell>
  );
}
