import Link from "next/link";

import { hasActiveDeskPlan, planModeLabel } from "@/lib/portal/title-limits";

export function PlanModeChip({
  deskExpiresAt,
  deskPlan = null,
  compact = false,
}: {
  deskExpiresAt?: string | null;
  deskPlan?: string | null;
  /** Shorter label on narrow phone headers. */
  compact?: boolean;
}) {
  const active = hasActiveDeskPlan(deskExpiresAt);
  const label = planModeLabel({ deskExpiresAt, deskPlan });
  const tone =
    label.mode === "trial"
      ? "bg-sky-500/15 text-sky-800 dark:text-sky-200"
      : label.mode === "paid"
        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
        : "bg-dash-muted text-dash-muted-foreground";
  const short =
    label.mode === "trial" ? "Trial" : label.mode === "paid" ? "Paid" : "Free";
  const full =
    label.mode === "trial" ? "2-week trial" : label.mode === "paid" ? "Paid plan" : "Free plan";
  return (
    <Link
      href="/portal/packs"
      className={`inline-flex items-center rounded-md px-1.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap sm:px-2 sm:text-[11px] ${tone}`}
      title={
        active
          ? label.detail || `${label.title}. Open Plans & access.`
          : "Free plan. Open Plans & access to upgrade."
      }
    >
      {compact ? short : full}
      <span className="sr-only"> plan · open Plans and access</span>
    </Link>
  );
}
