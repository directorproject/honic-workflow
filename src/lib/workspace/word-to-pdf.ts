import { Readable } from "node:stream";

import { getDriveApi, isDriveConfigured, resolveDriveFolderId } from "@/lib/google-drive-server";
import { isWordFile } from "@/lib/workspace/review-files";

const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive" as const;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const PDF_MIME = "application/pdf";

export { isPdfFileName, isReviewableFile, isWordFile } from "@/lib/workspace/review-files";

function officeSourceMime(name: string, mimeType?: string | null): string {
  const mime = String(mimeType ?? "").trim();
  if (mime === DOCX_MIME || mime === DOC_MIME) return mime;
  if (/\.docx$/i.test(name)) return DOCX_MIME;
  if (/\.doc$/i.test(name)) return DOC_MIME;
  return DOCX_MIME;
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Convert .doc / .docx → PDF via Google Drive (upload as Google Doc, export PDF, delete temp).
 * Uses the same Drive credentials as the rest of the portal.
 */
export async function convertWordBufferToPdf(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null,
): Promise<{ ok: true; pdf: Buffer; pdfName: string } | { ok: false; error: string }> {
  if (!isWordFile(fileName, mimeType)) {
    return { ok: false, error: "Only Word (.doc / .docx) can be converted." };
  }

  if (!isDriveConfigured()) {
    return {
      ok: false,
      error:
        "Word → PDF needs Google Drive configured. Set GOOGLE_DRIVE_FOLDER_ID and Drive credentials, or upload a PDF instead.",
    };
  }

  const folderId = resolveDriveFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);
  if (!folderId) {
    return { ok: false, error: "Set GOOGLE_DRIVE_FOLDER_ID to convert Word files for review." };
  }

  const api = await getDriveApi([SCOPE_DRIVE]);
  if (!api.ok) return { ok: false, error: api.error };

  const { drive } = api;
  const sourceMime = officeSourceMime(fileName, mimeType);
  const base = fileName.replace(/\.(docx|doc)$/i, "").trim() || "Document";
  const tempName = `${base} (review convert)`;
  let driveFileId: string | null = null;

  try {
    const created = await drive.files.create({
      requestBody: {
        name: tempName,
        parents: [folderId],
        mimeType: GOOGLE_DOC_MIME,
      },
      media: {
        mimeType: sourceMime,
        body: Readable.from(buffer),
      },
      fields: "id,mimeType",
      supportsAllDrives: true,
    });

    driveFileId = created.data.id ?? null;
    if (!driveFileId) {
      return { ok: false, error: "Drive did not accept the Word file for conversion." };
    }

    const exported = await drive.files.export(
      { fileId: driveFileId, mimeType: PDF_MIME },
      { responseType: "stream" },
    );
    const pdf = await streamToBuffer(exported.data as NodeJS.ReadableStream);
    if (!pdf.length) {
      return { ok: false, error: "Drive returned an empty PDF." };
    }

    return { ok: true, pdf, pdfName: `${base}.pdf` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/storage quota|service accounts do not have storage/i.test(msg)) {
      return {
        ok: false,
        error:
          "Drive blocked Word → PDF (storage quota). Use user OAuth for Drive, or upload a PDF for review.",
      };
    }
    return { ok: false, error: `Could not convert Word to PDF: ${msg}` };
  } finally {
    if (driveFileId) {
      try {
        await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
      } catch {
        /* temp cleanup best-effort */
      }
    }
  }
}
