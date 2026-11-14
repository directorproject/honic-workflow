import Link from "next/link";

import { hasActiveDeskPlan } from "@/lib/portal/title-limits";

export function PlanModeChip({ deskExpiresAt }: { deskExpiresAt?: string | null }) {
  const paid = hasActiveDeskPlan(deskExpiresAt);
  return (
    <Link
      href="/portal/packs"
      className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide ${
        paid
          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
          : "bg-dash-muted text-dash-muted-foreground"
      }`}
      title={paid ? "Paid plan active. Open Plans & access." : "Free plan. Open Plans & access to upgrade."}
    >
      {paid ? "Paid plan" : "Free plan"}
    </Link>
  );
}
