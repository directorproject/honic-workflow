"use server";

import { revalidatePath } from "next/cache";

import { normalizeShareResearchLinks } from "@/lib/share-client-references";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

const MAX_NOTES = 12000;

export async function updateProjectShareReferences(
  projectId: string,
  _prev: { ok: boolean; message?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, message: "Database not configured." };
  }

  const notesRaw = String(formData.get("share_research_notes") ?? "");
  const notes = notesRaw.trim().slice(0, MAX_NOTES);
  const linksJson = String(formData.get("share_research_links_json") ?? "").trim();

  let parsed: unknown;
  try {
    parsed = linksJson ? JSON.parse(linksJson) : [];
  } catch {
    return { ok: false, message: "Invalid links data. Refresh and try again." };
  }

  const links = normalizeShareResearchLinks(parsed);

  const { error } = await supabase
    .from("tracked_projects")
    .update({
      share_research_notes: notes.length > 0 ? notes : null,
      share_research_links: links,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/work`);
  revalidatePath("/");

  return { ok: true, message: "Saved references for share link." };
}
