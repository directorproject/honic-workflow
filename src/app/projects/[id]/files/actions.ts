"use server";

import { revalidatePath } from "next/cache";

import {
  ensureChildFolderByName,
  moveDriveFileIntoPipelineFolder,
  uploadFileToParentFolder,
} from "@/lib/google-drive-server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { WORKFLOW_STEPS, workflowStepUploadFolderLabel } from "@/lib/workflow-checklist";

const MAX_PROJECT_DRIVE_FILES_PER_SUBMIT = 25;

export type ProjectDriveUploadState =
  | {
      ok: true;
      kind: "upload" | "attach";
      pipelineStepLabel: string;
      items: { fileName: string; driveFileId: string; mimeType: string }[];
    }
  | { ok: false; message: string }
  | null;

export async function uploadProjectFileAction(
  projectId: string,
  _prev: ProjectDriveUploadState,
  formData: FormData,
): Promise<ProjectDriveUploadState> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, message: "Database not configured." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("tracked_projects")
    .select("google_drive_folder_id")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchErr || !row?.google_drive_folder_id) {
    return {
      ok: false,
      message: "This project has no Drive folder yet. Configure one on this page first.",
    };
  }

  const rawStep = String(formData.get("pipeline_step") ?? "").trim();
  const allowed = new Set<string>(WORKFLOW_STEPS.map((s) => s.key));
  if (!allowed.has(rawStep)) {
    return { ok: false, message: "Choose which pipeline activity this file is for." };
  }
  const pipelineStepLabel = workflowStepUploadFolderLabel(rawStep);

  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return { ok: false, message: "Choose one or more files to upload." };
  }
  if (files.length > MAX_PROJECT_DRIVE_FILES_PER_SUBMIT) {
    return {
      ok: false,
      message: `At most ${MAX_PROJECT_DRIVE_FILES_PER_SUBMIT} files per upload. Choose fewer files and try again.`,
    };
  }

  const ensured = await ensureChildFolderByName(row.google_drive_folder_id, pipelineStepLabel);
  if (!ensured.ok) {
    return { ok: false, message: ensured.error };
  }

  const items: { fileName: string; driveFileId: string; mimeType: string }[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFileToParentFolder(ensured.folderId, {
      rawName: file.name,
      mimeType: file.type,
      buffer,
    });

    if (!result.ok) {
      const moved = items.length;
      return {
        ok: false,
        message:
          moved > 0
            ? `${result.error}\n(${moved} file(s) were uploaded before this failure.)`
            : result.error,
      };
    }
    items.push({ fileName: result.name, driveFileId: result.id, mimeType: result.mimeType });
  }

  revalidatePath(`/projects/${projectId}/files`);
  revalidatePath(`/projects/${projectId}/work`);
  return {
    ok: true,
    kind: "upload" as const,
    pipelineStepLabel,
    items,
  };
}

export async function assignExistingProjectFileAction(
  projectId: string,
  _prev: ProjectDriveUploadState,
  formData: FormData,
): Promise<ProjectDriveUploadState> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, message: "Database not configured." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("tracked_projects")
    .select("google_drive_folder_id")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchErr || !row?.google_drive_folder_id) {
    return {
      ok: false,
      message: "This project has no Drive folder yet. Configure one on this page first.",
    };
  }

  const rawStep = String(formData.get("pipeline_step") ?? "").trim();
  const allowed = new Set<string>(WORKFLOW_STEPS.map((s) => s.key));
  if (!allowed.has(rawStep)) {
    return { ok: false, message: "Choose which pipeline activity this file is for." };
  }
  const pipelineStepLabel = workflowStepUploadFolderLabel(rawStep);

  const rawIds = formData.getAll("existing_drive_file_id").map((v) => String(v).trim()).filter(Boolean);
  const fileIds = [...new Set(rawIds)];
  if (fileIds.length === 0) {
    return { ok: false, message: "Select one or more files from your project folder, then move them." };
  }
  if (fileIds.length > MAX_PROJECT_DRIVE_FILES_PER_SUBMIT) {
    return {
      ok: false,
      message: `At most ${MAX_PROJECT_DRIVE_FILES_PER_SUBMIT} files per move. Select fewer files and try again.`,
    };
  }

  const ensured = await ensureChildFolderByName(row.google_drive_folder_id, pipelineStepLabel);
  if (!ensured.ok) {
    return { ok: false, message: ensured.error };
  }

  const items: { fileName: string; driveFileId: string; mimeType: string }[] = [];
  for (const fileId of fileIds) {
    const moved = await moveDriveFileIntoPipelineFolder(fileId, row.google_drive_folder_id, ensured.folderId);
    if (!moved.ok) {
      const done = items.length;
      return {
        ok: false,
        message:
          done > 0
            ? `${moved.error}\n(${done} file(s) were moved before this failure.)`
            : moved.error,
      };
    }
    items.push({ fileName: moved.name, driveFileId: fileId, mimeType: moved.mimeType });
  }

  revalidatePath(`/projects/${projectId}/files`);
  revalidatePath(`/projects/${projectId}/work`);
  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true,
    kind: "attach" as const,
    pipelineStepLabel,
    items,
  };
}
