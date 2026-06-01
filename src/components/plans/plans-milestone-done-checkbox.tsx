"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { updateMilestoneWorkStatus } from "@/app/plans/actions";

export function PlansMilestoneDoneCheckbox({
  milestoneId,
  done,
}: {
  milestoneId: string;
  done: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={done}
      disabled={pending}
      aria-label={done ? "Mark milestone not done" : "Mark milestone done"}
      title={done ? "Clear done" : "Mark done"}
      className="border-dash-border text-dash-accent focus:ring-dash-accent/30 h-4 w-4 rounded disabled:opacity-50"
      onChange={(e) => {
        const checked = e.target.checked;
        startTransition(async () => {
          try {
            await updateMilestoneWorkStatus(milestoneId, checked ? "done" : "pending");
          } finally {
            router.refresh();
          }
        });
      }}
    />
  );
}
