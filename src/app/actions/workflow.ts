"use server";

import { revalidatePath } from "next/cache";

import { notifyShareSubscribers } from "@/lib/share-push";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  WORKFLOW_STEPS,
  resolveProjectStatusFromPipeline,
  type WorkflowStepKey,
  type WorkflowStepStatus,
} from "@/lib/workflow-checklist";

const VALID = new Set<string>(["pending", "in_progress", "done", "not_provided"]);

export async function updateWorkflowStep(
  projectId: string,
  stepKey: WorkflowStepKey,
  status: WorkflowStepStatus
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Database not configured.");
  }

  if (!WORKFLOW_STEPS.some((s) => s.key === stepKey)) {
    throw new Error("Invalid workflow step.");
  }

  if (!VALID.has(status)) {
    throw new Error("Invalid status.");
  }

  const { data: row, error: fetchErr } = await supabase
    .from("tracked_projects")
    .select("workflow_checklist, status")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(fetchErr.message);
  }

  const current =
    row?.workflow_checklist && typeof row.workflow_checklist === "object"
      ? { ...(row.workflow_checklist as Record<string, string>) }
      : {};

  current[stepKey] = status;

  const currentStatus = typeof row?.status === "string" ? row.status : "planning";
  const nextStatus = resolveProjectStatusFromPipeline(current, currentStatus);

  const updatePayload: {
    workflow_checklist: Record<string, string>;
    updated_at: string;
    status?: string;
  } = {
    workflow_checklist: current,
    updated_at: new Date().toISOString(),
  };
  if (nextStatus && nextStatus !== currentStatus) {
    updatePayload.status = nextStatus;
  }

  const { error: upErr } = await supabase
    .from("tracked_projects")
    .update(updatePayload)
    .eq("id", projectId);

  if (upErr) {
    throw new Error(upErr.message);
  }

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/client-side");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/work`);

  const stepLabel = WORKFLOW_STEPS.find((s) => s.key === stepKey)?.label ?? stepKey;
  const statusLabel = status.replace(/_/g, " ");
  const notifyBody =
    nextStatus && nextStatus !== currentStatus
      ? `${stepLabel}: ${statusLabel} · Project moved to ${nextStatus.replace(/_/g, " ")}`
      : `${stepLabel}: ${statusLabel}`;
  await notifyShareSubscribers({
    trackedProjectId: projectId,
    title: "Project activity updated",
    body: notifyBody,
  });
}
