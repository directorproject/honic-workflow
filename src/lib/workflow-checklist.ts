/** Matches supabase/007_workflow_checklist.sql JSON keys */

/**
 * `not_provided`: Outside our scope — still counts as full credit in **weighted** pipeline % (same as done).
 * `in_progress`: Counts as **half** credit toward weighted %.
 */
export type WorkflowStepStatus = "pending" | "in_progress" | "done" | "not_provided";

export const WORKFLOW_STEPS = [
  { key: "schematic_circuit", label: "Schematic circuit" },
  { key: "circuit_simulation", label: "Circuit simulation" },
  { key: "pcb_layout", label: "PCB layout" },
  { key: "pcb_fabrication", label: "PCB fabrication" },
  { key: "programming", label: "Programming" },
  { key: "assembling_test", label: "Assembling circuit & test" },
  { key: "prototype", label: "Prototype" },
  { key: "full_project_test", label: "Full project test" },
  { key: "client_check", label: "Client check" },
  { key: "give_to_client", label: "Give to client" },
] as const;

export type WorkflowStepKey = (typeof WORKFLOW_STEPS)[number]["key"];

/** Drive uploads use this label as the subfolder name under the project folder. */
export function workflowStepUploadFolderLabel(key: string): string {
  const row = WORKFLOW_STEPS.find((s) => s.key === key);
  return row?.label ?? key.replace(/_/g, " ");
}

const VALID: WorkflowStepStatus[] = ["pending", "in_progress", "done", "not_provided"];

export function normalizeWorkflowChecklist(raw: unknown): Record<string, WorkflowStepStatus> {
  const out: Record<string, WorkflowStepStatus> = {};
  if (!raw || typeof raw !== "object") {
    for (const s of WORKFLOW_STEPS) {
      out[s.key] = "pending";
    }
    return out;
  }
  const obj = raw as Record<string, unknown>;
  for (const s of WORKFLOW_STEPS) {
    const v = obj[s.key];
    const str = typeof v === "string" ? v : "";
    out[s.key] = VALID.includes(str as WorkflowStepStatus)
      ? (str as WorkflowStepStatus)
      : "pending";
  }
  return out;
}

/** Weight for pipeline %: done & outside scope = 1; in progress = ½; pending = 0. */
export function workflowActivityWeight(status: WorkflowStepStatus): number {
  if (status === "done" || status === "not_provided") return 1;
  if (status === "in_progress") return 0.5;
  return 0;
}

/** 0–1: sum of step weights / number of steps (same basis as `weightedPercent`). */
export function workflowCompletionRatio(checklist: Record<string, WorkflowStepStatus>): number {
  let sum = 0;
  for (const s of WORKFLOW_STEPS) {
    sum += workflowActivityWeight(checklist[s.key] ?? "pending");
  }
  return WORKFLOW_STEPS.length ? sum / WORKFLOW_STEPS.length : 0;
}

/** For compact dashboard columns: how many steps are done / in progress / total + weighted %. */
export function workflowStepCounts(raw: unknown): {
  done: number;
  inProgress: number;
  notProvided: number;
  total: number;
  /** Steps we might still deliver (excludes outside-scope). */
  inScopeTotal: number;
  /** Done by us + marked outside our scope (closed on the board), e.g. 5+2=7 of 10. */
  addressed: number;
  /** Sum of per-step weights (max = total). Outside scope = 1; in progress = 0.5. */
  weightedPoints: number;
  /** 0–100 from weightedPoints / total. */
  weightedPercent: number;
} {
  const n = normalizeWorkflowChecklist(raw);
  let done = 0;
  let inProgress = 0;
  let notProvided = 0;
  let weightedPoints = 0;
  for (const s of WORKFLOW_STEPS) {
    const v = n[s.key] ?? "pending";
    if (v === "done") done += 1;
    else if (v === "in_progress") inProgress += 1;
    else if (v === "not_provided") notProvided += 1;
    weightedPoints += workflowActivityWeight(v);
  }
  const total = WORKFLOW_STEPS.length;
  const inScopeTotal = total - notProvided;
  const addressed = done + notProvided;
  const weightedPercent = total ? Math.min(100, Math.round((weightedPoints / total) * 100)) : 0;
  return { done, inProgress, notProvided, total, inScopeTotal, addressed, weightedPoints, weightedPercent };
}
