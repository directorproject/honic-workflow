import { listDriveFolder, type DriveFileRow } from "@/lib/google-drive-server";
import {
  PIPELINE_DOCUMENTS_FOLDER_NAME,
  PIPELINE_DOCUMENTS_KEY,
  pipelineActivityUploadFolderLabel,
} from "@/lib/pipeline-activity-labels";
import { WORKFLOW_STEPS } from "@/lib/workflow-checklist";

/** Optional folder at the project Drive root; listed after “Full project test” in Files by pipeline activity. */
export { PIPELINE_DOCUMENTS_FOLDER_NAME, PIPELINE_DOCUMENTS_KEY, pipelineActivityUploadFolderLabel };

export type ProjectPipelineActivityFiles = {
  key: string;
  label: string;
  folderId: string | null;
  files: DriveFileRow[];
  listError?: string;
};

/**
 * For each pipeline step, find the matching subfolder under the project Drive folder (same names as uploads)
 * and list files inside for the project view page.
 */
export async function loadProjectPipelineFilesForView(
  projectDriveFolderId: string,
): Promise<{ ok: true; activities: ProjectPipelineActivityFiles[] } | { ok: false; error: string }> {
  const rootList = await listDriveFolder({ parentFolderId: projectDriveFolderId });
  if (!rootList.ok) {
    return { ok: false, error: rootList.error };
  }

  const childFolders = rootList.files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");

  const stepActivities: ProjectPipelineActivityFiles[] = await Promise.all(
    WORKFLOW_STEPS.map(async (step) => {
      const folderName = pipelineActivityUploadFolderLabel(step.key);
      const folder = childFolders.find((f) => f.name === folderName);
      if (!folder?.id) {
        return { key: step.key, label: step.label, folderId: null, files: [] };
      }
      const inner = await listDriveFolder({ parentFolderId: folder.id });
      if (!inner.ok) {
        return { key: step.key, label: step.label, folderId: folder.id, files: [], listError: inner.error };
      }
      const files = inner.files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder");
      return { key: step.key, label: step.label, folderId: folder.id, files };
    }),
  );

  const docsFolder = childFolders.find((f) => f.name === PIPELINE_DOCUMENTS_FOLDER_NAME);
  let pipelineDocuments: ProjectPipelineActivityFiles = {
    key: PIPELINE_DOCUMENTS_KEY,
    label: PIPELINE_DOCUMENTS_FOLDER_NAME,
    folderId: docsFolder?.id ?? null,
    files: [],
  };
  if (docsFolder?.id) {
    const inner = await listDriveFolder({ parentFolderId: docsFolder.id });
    if (!inner.ok) {
      pipelineDocuments = { ...pipelineDocuments, listError: inner.error };
    } else {
      pipelineDocuments = {
        ...pipelineDocuments,
        files: inner.files.filter((f) => f.mimeType !== "application/vnd.google-apps.folder"),
      };
    }
  }

  const afterFullTestIdx = WORKFLOW_STEPS.findIndex((s) => s.key === "full_project_test");
  const splitAt = afterFullTestIdx >= 0 ? afterFullTestIdx + 1 : stepActivities.length;
  const activities = [...stepActivities.slice(0, splitAt), pipelineDocuments, ...stepActivities.slice(splitAt)];

  return { ok: true, activities };
}
