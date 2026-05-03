"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type UpdateRegisteredClientState = { ok: true } | { ok: false; message: string } | null;

export async function updateRegisteredClientForProjectAction(
  projectId: string,
  _prev: UpdateRegisteredClientState,
  formData: FormData,
): Promise<UpdateRegisteredClientState> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const shareRaw = (formData.get("share_subdomain") as string | null)?.trim() ?? "";
  const share_subdomain = shareRaw.length > 0 ? shareRaw.toLowerCase() : null;

  if (!name) {
    return { ok: false, message: "Client name is required." };
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

  const { error } = await supabase
    .from("registered_clients")
    .update({ name, share_subdomain })
    .eq("id", clientId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "That client name is already used. Choose a different name." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(`/projects/${projectId}/work`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true };
}
