import Link from "next/link";

import { PlanStatusBanner } from "@/components/portal/plan-status-banner";
import { SelectedTitlesBoard } from "@/components/portal/selected-titles-board";
import { TitleClaimForm } from "@/components/portal/title-claim-form";
import { TitleEngagementStats } from "@/components/portal/title-engagement-stats";
import type { PortalTitle } from "@/lib/portal/data";
import { claimKindLabel, type OwnershipCatalogueItem, type TitleClaim } from "@/lib/portal/title-claims";
import { engagementKey, type TitleEngagement } from "@/lib/portal/title-engagement";
import type { TitleHideEntitlement } from "@/lib/portal/title-limits";

export function MyProjectsPanel({
  selected,
  phone,
  changeCredits,
  projectStarted,
  claims,
  catalogue,
  entitlement,
  deskExpiresAt,
  deskPlan,
  engagementByTarget,
}: {
  selected: PortalTitle[];
  phone: string;
  changeCredits: number;
  projectStarted: boolean;
  claims: TitleClaim[];
  catalogue: OwnershipCatalogueItem[];
  entitlement?: TitleHideEntitlement | null;
  deskExpiresAt?: string | null;
  deskPlan?: string | null;
  engagementByTarget?: Record<string, TitleEngagement>;
}) {
  const hiddenCount = selected.filter((t) => t.hiddenFromPeers).length;
  return (
    <div className="space-y-12">
      <PlanStatusBanner
        deskExpiresAt={deskExpiresAt}
        deskPlan={deskPlan}
        selectedCount={selected.length}
        hiddenCount={hiddenCount}
        freeRemaining={entitlement?.freeRemaining}
      />
      <SelectedTitlesBoard
        selected={selected}
        phone={phone}
        changeCredits={changeCredits}
        projectStarted={projectStarted}
        entitlement={entitlement}
      />

      <section className="border-dash-border border-t pt-10">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">Ownership</p>
        <h2 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight">Claimed titles</h2>
        <p className="text-dash-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Titles you have claimed as yours. Admin confirms ownership before it counts on this portal.
        </p>
        {claims.length ? (
          <ul className="mt-6 space-y-4">
            {claims.map((claim) => (
              <li key={claim.id} className="border-dash-border rounded-xl border px-4 py-4">
                <p className="text-dash-foreground text-sm font-semibold leading-snug">{claim.title}</p>
                <p className="text-dash-muted-foreground mt-1 text-xs">
                  {claimKindLabel(claim.requestKind)}. {claim.status}
                  {claim.publicId ? ` (${claim.publicId.slice(0, 12)}…)` : ""}
                </p>
                {claim.sealedAt ? (
                  <p className="text-dash-muted-foreground mt-1 text-xs">Sealed for review. Integrity lock on.</p>
                ) : null}
                {claim.explanation ? <p className="mt-2 text-sm leading-relaxed">{claim.explanation}</p> : null}
                {claim.status === "confirmed" && claim.targetId && claim.targetKind ? (
                  <div className="mt-3">
                    <TitleEngagementStats
                      compact
                      stats={engagementByTarget?.[engagementKey(claim.targetKind, claim.targetId)] ?? null}
                    />
                    <Link
                      href={`/portal/titles/${encodeURIComponent(claim.targetKind === "earlier" ? `earlier:${claim.targetId}` : claim.targetId)}`}
                      className="text-dash-accent mt-2 inline-block text-sm font-semibold"
                    >
                      Open and publish documents
                    </Link>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-dash-muted-foreground mt-6 text-sm">No claimed titles yet.</p>
        )}
      </section>

      <section className="border-dash-border border-t pt-10">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">Ownership</p>
        <h2 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight">Claim a title</h2>
        <p className="text-dash-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Search your title, upload project files, then prove ownership with an ID or image or short answers. Admin confirms
          before it counts.
        </p>
        <div className="mt-6">
          <TitleClaimForm catalogue={catalogue} />
        </div>
      </section>
    </div>
  );
}
