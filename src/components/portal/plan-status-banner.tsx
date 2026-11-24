import Link from "next/link";

import { planModeLabel } from "@/lib/portal/title-limits";

/** Compact plan mode callout for My projects and similar pages. */
export function PlanStatusBanner({
  deskExpiresAt,
  deskPlan,
  selectedCount,
  hiddenCount,
  freeRemaining,
}: {
  deskExpiresAt?: string | null;
  deskPlan?: string | null;
  selectedCount: number;
  hiddenCount: number;
  freeRemaining?: number;
}) {
  const plan = planModeLabel({ deskExpiresAt, deskPlan });
  return (
    <aside className="border-dash-border bg-dash-card rounded-2xl border px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">Your plan</p>
          <p className="text-dash-foreground mt-1 text-lg font-semibold tracking-tight">{plan.title}</p>
          {plan.detail ? (
            <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">{plan.detail}</p>
          ) : null}
          <p className="text-dash-muted-foreground mt-3 text-sm leading-relaxed">
            <strong className="text-dash-foreground font-semibold">Select</strong> keeps a title in front for you or with
            your partner. <strong className="text-dash-foreground font-semibold">Pay</strong> or use a paid plan to hide
            and make it yours. It is not a purchase of the idea. It only hides the title from others for conflict
            protection for defence.
          </p>
        </div>
        <div className="shrink-0 text-right text-xs">
          <p className="text-dash-foreground font-semibold tabular-nums">
            {selectedCount} shortlisted · {hiddenCount} hidden
          </p>
          {(plan.mode === "paid" || plan.mode === "trial") && freeRemaining != null ? (
            <p className="text-dash-muted-foreground mt-1">{freeRemaining} free hides left</p>
          ) : (
            <p className="text-dash-muted-foreground mt-1">Pay to hide and make yours</p>
          )}
          <Link href="/portal/packs" className="text-dash-accent mt-2 inline-block font-semibold">
            {plan.mode === "paid" ? "Manage plan →" : plan.mode === "trial" ? "Keep access after trial →" : "See paid plans →"}
          </Link>
        </div>
      </div>
    </aside>
  );
}
