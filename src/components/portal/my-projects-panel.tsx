import { PlanStatusBanner } from "@/components/portal/plan-status-banner";
import { SelectedTitlesBoard } from "@/components/portal/selected-titles-board";
import type { PortalTitle } from "@/lib/portal/data";
import type { TitleHideEntitlement } from "@/lib/portal/title-limits";

export function MyProjectsPanel({
  selected,
  phone,
  changeCredits,
  projectStarted,
  entitlement,
  deskExpiresAt,
  deskPlan,
}: {
  selected: PortalTitle[];
  phone: string;
  changeCredits: number;
  projectStarted: boolean;
  entitlement?: TitleHideEntitlement | null;
  deskExpiresAt?: string | null;
  deskPlan?: string | null;
}) {
  const hiddenCount = selected.filter((t) => t.hiddenFromPeers).length;
  return (
    <div className="space-y-6">
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
    </div>
  );
}