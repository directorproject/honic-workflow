const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const PDF_MIME = "application/pdf";

export function isWordFile(name: string, mimeType?: string | null): boolean {
  const mime = String(mimeType ?? "");
  if (mime === DOCX_MIME || mime === DOC_MIME) return true;
  return /\.(docx|doc)$/i.test(name);
}

export function isPdfFileName(name: string, mimeType?: string | null): boolean {
  return mimeType === PDF_MIME || /\.pdf$/i.test(name);
}

/** True for files Review can open (PDF directly, Word after conversion). */
export function isReviewableFile(name: string, mimeType?: string | null): boolean {
  return isPdfFileName(name, mimeType) || isWordFile(name, mimeType);
}
