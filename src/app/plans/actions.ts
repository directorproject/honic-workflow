"use server";

import { requireStaffActor } from "@/lib/auth-staff";

import { revalidatePath } from "next/cache";

import { type MilestoneWorkStatusValue, isMilestoneWorkStatus } from "@/lib/milestone-work-status";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export async function updateMilestoneWorkStatus(milestoneId: string, workStatusRaw: string) {
  await requireStaffActor();
  const id = String(milestoneId ?? "").trim();
  const raw = String(workStatusRaw ?? "").trim();
  if (!id || !isMilestoneWorkStatus(raw)) {
    throw new Error("Invalid milestone or status.");
  }
  const workStatus = raw as MilestoneWorkStatusValue;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Database not configured.");
  }

  const { data: row, error: fetchErr } = await supabase
    .from("project_milestones")
    .select("tracked_project_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row?.tracked_project_id) {
    throw new Error(fetchErr?.message ?? "Milestone not found.");
  }

  const completed_at = workStatus === "done" ? new Date().toISOString() : null;

  const { error } = await supabase.from("project_milestones").update({ work_status: workStatus, completed_at }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  const pid = row.tracked_project_id as string;
  revalidatePath("/plans");
  revalidatePath("/projects");
  revalidatePath("/");
  revalidatePath(`/projects/${pid}`);
  revalidatePath(`/projects/${pid}/work`);
}
