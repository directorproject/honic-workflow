import Link from "next/link";

import { hasActiveDeskPlan } from "@/lib/portal/title-limits";

export function PlanModeChip({
  deskExpiresAt,
  compact = false,
}: {
  deskExpiresAt?: string | null;
  /** Shorter label on narrow phone headers. */
  compact?: boolean;
}) {
  const paid = hasActiveDeskPlan(deskExpiresAt);
  return (
    <Link
      href="/portal/packs"
      className={`inline-flex items-center rounded-md px-1.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap sm:px-2 sm:text-[11px] ${
        paid
          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
          : "bg-dash-muted text-dash-muted-foreground"
      }`}
      title={paid ? "Paid plan active. Open Plans & access." : "Free plan. Open Plans & access to upgrade."}
    >
      {compact ? (paid ? "Paid" : "Free") : paid ? "Paid plan" : "Free plan"}
      <span className="sr-only"> plan · open Plans and access</span>
    </Link>
  );
}
