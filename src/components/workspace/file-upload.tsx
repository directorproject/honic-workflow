"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import { confirmUploadAction, createUploadAction } from "@/app/portal/workspace-actions";
import { useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_SOFT } from "@/components/workspace/ws-ui";
import { DEFAULT_FILE_FOLDER, MAX_UPLOAD_BYTES, STORAGE_BUCKET } from "@/lib/workspace/constants";

let browserClient: ReturnType<typeof createClient> | null = null;
function storageClient() {
  if (!browserClient) {
    browserClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return browserClient;
}

export function useProjectFileUpload(
  opts: {
    folder?: string;
    documentId?: string | null;
    eventId?: string | null;
    /** Where the file was obtained (e.g. Muhimbili Hospital). */
    obtainedPlace?: string | null;
    /** Override folder per file (e.g. Field study → Images / Videos / Audios). */
    resolveFolder?: (file: File) => string;
  } = {},
) {
  const folder = opts.folder ?? DEFAULT_FILE_FOLDER;
  const documentId = opts.documentId ?? null;
  const eventId = opts.eventId ?? null;
  const obtainedPlace = opts.obtainedPlace ?? null;
  const resolveFolder = opts.resolveFolder;
  const { workspaceId, viewer } = useWs();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function uploadFiles(files: FileList | File[], placeOverride?: string | null) {
    if (!viewer.canEdit) return;
    setError("");
    const place = placeOverride !== undefined ? placeOverride : obtainedPlace;
    const list = Array.from(files);
    for (const file of list) {
      try {
        if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
        const destFolder = resolveFolder?.(file) ?? folder;
        setBusy(`Preparing ${file.name}…`);
        const start = await createUploadAction(workspaceId, { name: file.name, size: file.size });
        if (!start.ok || !start.data) throw new Error(start.ok ? "Could not start the upload." : start.message);
        setBusy(`Sending ${file.name}…`);
        const { error: upErr } = await storageClient()
          .storage.from(STORAGE_BUCKET)
          .uploadToSignedUrl(start.data.path, start.data.token, file, {
            contentType: file.type || "application/octet-stream",
          });
        if (upErr) throw new Error(upErr.message);
        setBusy(`Saving ${file.name} → ${destFolder}…`);
        const done = await confirmUploadAction(workspaceId, {
          path: start.data.path,
          name: file.name,
          type: file.type,
          folder: destFolder,
          documentId,
          eventId,
          obtainedPlace: place,
          size: file.size,
        });
        if (!done.ok) throw new Error(done.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
        setBusy("");
        return;
      }
    }
    setBusy("Refreshing…");
    router.refresh();
    setBusy("");
  }

  return { canEdit: viewer.canEdit, busy, error, uploadFiles, setError };
}

const DEFAULT_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.7z,.dwg,.dxf,image/*,application/pdf";

/** Photos, video, audio, docs — used from Field study captures. */
export const FIELD_CAPTURE_ACCEPT =
  "image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.heic,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a,.zip,.rar,.7z,application/pdf";

/** Uploads straight to private storage with a signed URL, then records the file. */
export function FileUploadButton({
  folder = DEFAULT_FILE_FOLDER,
  documentId = null,
  eventId = null,
  obtainedPlace = null,
  label = "Upload files",
  soft = false,
  accept = DEFAULT_ACCEPT,
  resolveFolder,
}: {
  folder?: string;
  documentId?: string | null;
  eventId?: string | null;
  obtainedPlace?: string | null;
  label?: string;
  soft?: boolean;
  accept?: string;
  resolveFolder?: (file: File) => string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { canEdit, busy, error, uploadFiles } = useProjectFileUpload({
    folder,
    documentId,
    eventId,
    obtainedPlace,
    resolveFolder,
  });
  if (!canEdit) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button type="button" disabled={Boolean(busy)} onClick={() => input.current?.click()} className={soft ? BTN_SOFT : BTN}>
        {busy ? "Uploading…" : label}
      </button>
      {busy ? <span className="text-dash-muted-foreground text-xs">{busy}</span> : null}
      {error ? <span className="text-xs text-red-600 dark:text-red-300">{error}</span> : null}
    </span>
  );
}

export function FilesDropZone({
  folder = DEFAULT_FILE_FOLDER,
  children,
  compact = false,
}: {
  folder?: string;
  children?: ReactNode;
  /** Tighter rail-style drop target for split layouts. */
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { canEdit, busy, error, uploadFiles } = useProjectFileUpload({ folder });
  if (!canEdit) return null;

  return (
    <div
      className={`border-dash-border relative border border-dashed transition ${
        compact ? "rounded-sm px-4 py-5" : "rounded-sm px-5 py-7"
      } ${over ? "border-dash-accent bg-dash-accent/5" : "bg-dash-card/60"}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.7z,.dwg,.dxf,image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className={`flex flex-col ${compact ? "items-stretch text-left" : "mx-auto max-w-md items-center text-center"}`}>
        {compact ? null : <UploadIcon />}
        <p className={`text-dash-foreground font-semibold tracking-tight ${compact ? "text-sm" : "mt-3 text-base"}`}>
          {busy ? "Uploading…" : compact ? `Add to “${folder}”` : "Drop files here"}
        </p>
        <p className={`text-dash-muted-foreground leading-relaxed ${compact ? "mt-1 text-xs" : "mt-1 text-sm"}`}>
          {compact
            ? `Files go into this group. PDF, Word, PPT, images, CAD, zip. 25 MB max.`
            : `Uploads into “${folder}”. PDF, Word, PowerPoint, images, CAD, or zip. Max 25 MB each.`}
        </p>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => input.current?.click()}
          className={`${BTN} disabled:opacity-60 ${compact ? "mt-4 w-full" : "mt-5"}`}
        >
          {busy ? "Uploading…" : "Choose files"}
        </button>
        {busy ? <p className="text-dash-muted-foreground mt-3 text-xs">{busy}</p> : null}
        {error ? <p className="mt-3 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
        {children}
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <span className="bg-dash-muted text-dash-accent inline-flex h-12 w-12 items-center justify-center rounded-2xl">
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    </span>
  );
}
