"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { updateMilestoneWorkStatus } from "@/app/plans/actions";
import {
  MILESTONE_WORK_STATUSES,
  type MilestoneWorkStatusValue,
  milestoneWorkStatusLabel,
  normalizeMilestoneWorkStatus,
} from "@/lib/milestone-work-status";

export function MilestoneWorkStatusSelect({
  milestoneId,
  value,
}: {
  milestoneId: string;
  value: MilestoneWorkStatusValue;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const normalized = normalizeMilestoneWorkStatus(value);

  return (
    <select
      key={`${milestoneId}-${normalized}`}
      aria-label="Milestone workflow status"
      disabled={pending}
      defaultValue={normalized}
      onChange={(e) => {
        const next = normalizeMilestoneWorkStatus(e.target.value);
        startTransition(async () => {
          try {
            await updateMilestoneWorkStatus(milestoneId, next);
          } finally {
            router.refresh();
          }
        });
      }}
      className="border-dash-border bg-dash-muted/40 text-dash-foreground focus:ring-dash-accent/25 max-w-[11rem] rounded-lg border px-2 py-1.5 text-[11px] font-semibold outline-none focus:ring-2 disabled:opacity-50"
    >
      {MILESTONE_WORK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {milestoneWorkStatusLabel(s)}
        </option>
      ))}
    </select>
  );
}
