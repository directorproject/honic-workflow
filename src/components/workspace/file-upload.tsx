"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { confirmUploadAction, createUploadAction } from "@/app/portal/workspace-actions";
import { useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_SOFT } from "@/components/workspace/ws-ui";
import { MAX_UPLOAD_BYTES, STORAGE_BUCKET } from "@/lib/workspace/constants";

let browserClient: ReturnType<typeof createClient> | null = null;
function storageClient() {
  if (!browserClient) {
    browserClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return browserClient;
}

/** Uploads straight to private storage with a signed URL, then records the file. */
export function FileUploadButton({
  folder = "General",
  documentId = null,
  label = "Upload files",
  soft = false,
}: {
  folder?: string;
  documentId?: string | null;
  label?: string;
  soft?: boolean;
}) {
  const { workspaceId, viewer } = useWs();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  if (!viewer.canEdit) return null;

  async function upload(files: FileList) {
    setError("");
    for (const file of Array.from(files)) {
      try {
        if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
        setBusy(`Uploading ${file.name}…`);
        const start = await createUploadAction(workspaceId, { name: file.name, size: file.size });
        if (!start.ok || !start.data) throw new Error(start.ok ? "Could not start the upload." : start.message);
        const { error: upErr } = await storageClient()
          .storage.from(STORAGE_BUCKET)
          .uploadToSignedUrl(start.data.path, start.data.token, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) throw new Error(upErr.message);
        const done = await confirmUploadAction(workspaceId, {
          path: start.data.path,
          name: file.name,
          type: file.type,
          folder,
          documentId,
        });
        if (!done.ok) throw new Error(done.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
        break;
      }
    }
    setBusy("");
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input ref={input} type="file" multiple className="hidden" onChange={(e) => e.target.files?.length && void upload(e.target.files)} />
      <button type="button" disabled={Boolean(busy)} onClick={() => input.current?.click()} className={soft ? BTN_SOFT : BTN}>
        {busy ? "Uploading…" : label}
      </button>
      {busy ? <span className="text-dash-muted-foreground text-xs">{busy}</span> : null}
      {error ? <span className="text-xs text-red-600 dark:text-red-300">{error}</span> : null}
    </span>
  );
}
