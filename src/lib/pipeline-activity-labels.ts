import { workflowStepUploadFolderLabel } from "@/lib/workflow-checklist";

export const PIPELINE_DOCUMENTS_FOLDER_NAME = "Pipeline documents";
export const PIPELINE_DOCUMENTS_KEY = "pipeline_documents";

/** Upload/move target key -> exact Drive subfolder label. */
export function pipelineActivityUploadFolderLabel(key: string): string {
  if (key === PIPELINE_DOCUMENTS_KEY) return PIPELINE_DOCUMENTS_FOLDER_NAME;
  return workflowStepUploadFolderLabel(key);
}
