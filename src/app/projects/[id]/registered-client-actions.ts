"use server";

import { revalidatePath } from "next/cache";

import { PROJECT_TYPES, type ProjectTypeValue } from "@/lib/project-types";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

const MAX_PROJECT_TITLE = 500;
const MAX_PROJECT_DESCRIPTION = 8000;

export type UpdateRegisteredClientState = { ok: true } | { ok: false; message: string } | null;

export async function updateRegisteredClientForProjectAction(
  projectId: string,
  _prev: UpdateRegisteredClientState,
  formData: FormData,
): Promise<UpdateRegisteredClientState> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const shareRaw = (formData.get("share_subdomain") as string | null)?.trim() ?? "";
  const share_subdomain = shareRaw.length > 0 ? shareRaw.toLowerCase() : null;
  const phoneRaw = (formData.get("phone") as string | null)?.trim() ?? "";
  const phone = phoneRaw.length > 0 ? phoneRaw : null;

  const projectTitle = (formData.get("project_title") as string | null)?.trim().slice(0, MAX_PROJECT_TITLE) ?? "";
  const rawType = String(formData.get("project_type") ?? "").trim();
  const allowedTypes = new Set<string>(PROJECT_TYPES.map((p) => p.value));
  const priority = String(formData.get("priority") ?? "medium").trim();
  const allowedPriority = new Set(["low", "medium", "high", "critical"]);
  const descRaw = formData.get("description");
  const descriptionTrimmed =
    descRaw != null ? String(descRaw).trim().slice(0, MAX_PROJECT_DESCRIPTION) : "";
  const description = descriptionTrimmed.length > 0 ? descriptionTrimmed : null;

  if (!name) {
    return { ok: false, message: "Client name is required." };
  }
  if (!projectTitle) {
    return { ok: false, message: "Project title is required." };
  }
  if (!allowedTypes.has(rawType)) {
    return { ok: false, message: "Choose a valid project type." };
  }
  if (!allowedPriority.has(priority)) {
    return { ok: false, message: "Choose a valid priority." };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, message: "Database not configured." };
  }

  const { data: proj, error: pe } = await supabase
    .from("tracked_projects")
    .select("registered_client_id")
    .eq("id", projectId)
    .maybeSingle();

  if (pe || !proj?.registered_client_id) {
    return { ok: false, message: pe?.message ?? "Project not found." };
  }

  const clientId = proj.registered_client_id as string;

  const { error: clientErr } = await supabase
    .from("registered_clients")
    .update({ name, share_subdomain, phone })
    .eq("id", clientId);

  if (clientErr) {
    if (clientErr.code === "23505") {
      return { ok: false, message: "That client name is already used. Choose a different name." };
    }
    return { ok: false, message: clientErr.message };
  }

  const { error: projectErr } = await supabase
    .from("tracked_projects")
    .update({
      title: projectTitle,
      project_type: rawType as ProjectTypeValue,
      priority,
      description,
    })
    .eq("id", projectId);

  if (projectErr) {
    if (projectErr.message.includes("tracked_projects_project_type_check")) {
      return {
        ok: false,
        message:
          `${projectErr.message} Run supabase/010_project_type_constraint_fix.sql if your database check is out of date.`,
      };
    }
    return { ok: false, message: projectErr.message };
  }

  revalidatePath(`/projects/${projectId}/work`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true };
}
