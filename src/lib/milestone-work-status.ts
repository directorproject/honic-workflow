export const MILESTONE_WORK_STATUSES = ["pending", "in_progress", "blocked", "done"] as const;

export type MilestoneWorkStatusValue = (typeof MILESTONE_WORK_STATUSES)[number];

const LABEL: Record<MilestoneWorkStatusValue, string> = {
  pending: "Pending",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export function milestoneWorkStatusLabel(value: string): string {
  if (MILESTONE_WORK_STATUSES.includes(value as MilestoneWorkStatusValue)) {
    return LABEL[value as MilestoneWorkStatusValue];
  }
  return value.replace(/_/g, " ");
}

export function normalizeMilestoneWorkStatus(raw: string | null | undefined): MilestoneWorkStatusValue {
  const v = String(raw ?? "").trim();
  if (MILESTONE_WORK_STATUSES.includes(v as MilestoneWorkStatusValue)) {
    return v as MilestoneWorkStatusValue;
  }
  return "pending";
}

export function isMilestoneWorkStatus(s: string): s is MilestoneWorkStatusValue {
  return (MILESTONE_WORK_STATUSES as readonly string[]).includes(s);
}
