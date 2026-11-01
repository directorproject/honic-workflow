"use client";

import { useMemo, useState } from "react";

import { deleteFileAction } from "@/app/portal/workspace-actions";
import { FileUploadButton } from "@/components/workspace/file-upload";
import { fileUrl, useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN_DANGER, BTN_GHOST, Empty, INPUT, Panel, Status } from "@/components/workspace/ws-ui";
import { FILE_FOLDERS, formatBytes } from "@/lib/workspace/constants";
import { formatDateTime } from "@/lib/workspace/dates";
import type { DocumentItem, FileItem } from "@/lib/workspace/types";

function icon(mime: string | null, name: string): string {
  if (mime?.startsWith("image/")) return "🖼";
  if (mime?.startsWith("video/")) return "🎬";
  if (mime === "application/pdf") return "📕";
  if (/\.(c|cpp|h|ino|py|js|ts|java|m)$/i.test(name)) return "💾";
  if (/\.(zip|rar|7z)$/i.test(name)) return "🗜";
  return "📄";
}

export function FilesSection({ files, documents }: { files: FileItem[]; documents: DocumentItem[] }) {
  const ctx = useWs();
  const { workspaceId, viewer } = ctx;
  const { run, status } = useRun();
  const [folder, setFolder] = useState("All");
  const [q, setQ] = useState("");
  const [uploadFolder, setUploadFolder] = useState("General");
  const folders = useMemo(() => ["All", ...new Set([...FILE_FOLDERS, ...files.map((f) => f.folder)])], [files]);
  const list = files.filter((f) => (folder === "All" || f.folder === folder) && (!q || f.name.toLowerCase().includes(q.toLowerCase())));
  const used = files.reduce((s, f) => s + f.size_bytes, 0);

  return (
    <Panel
      title="Files"
      subtitle={`Code, circuit diagrams, photos, videos and datasheets. ${formatBytes(used)} of 500 MB used; up to 25 MB per file.`}
      actions={
        viewer.canEdit ? (
          <>
            <select value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} className={`${INPUT} w-auto`} aria-label="Upload to folder">
              {FILE_FOLDERS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            <FileUploadButton folder={uploadFolder} />
          </>
        ) : null
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {folders.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFolder(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${folder === f ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground hover:text-dash-foreground"}`}
          >
            {f} {f === "All" ? files.length : files.filter((x) => x.folder === f).length || ""}
          </button>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files" className={`${INPUT} mb-3 max-w-sm`} />
      <Status status={status} />
      {list.length ? (
        <ul className="divide-dash-border divide-y">
          {list.map((f) => {
            const doc = documents.find((d) => d.id === f.document_id);
            const previewable = f.mime_type?.startsWith("image/") || f.mime_type === "application/pdf" || f.mime_type?.startsWith("video/");
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="text-xl" aria-hidden>
                  {icon(f.mime_type, f.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <a href={fileUrl(ctx, f.id)} className="text-dash-foreground block truncate text-sm font-medium hover:underline">
                    {f.name}
                  </a>
                  <p className="text-dash-muted-foreground text-xs">
                    {f.folder} · {formatBytes(f.size_bytes)} · {f.uploaded_by_name ?? ""} · {formatDateTime(f.created_at)}
                  </p>
                </div>
                {doc ? <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300">{doc.name}</Badge> : null}
                {previewable ? (
                  <a href={fileUrl(ctx, f.id, true)} target="_blank" rel="noreferrer" className={BTN_GHOST}>
                    View
                  </a>
                ) : null}
                <a href={fileUrl(ctx, f.id)} className={BTN_GHOST}>
                  Download
                </a>
                {viewer.canEdit ? (
                  <button
                    type="button"
                    className={BTN_DANGER}
                    onClick={() => window.confirm(`Delete "${f.name}"?`) && run(() => deleteFileAction(workspaceId, f.id))}
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title={files.length ? "No files match" : "No files yet"}>Upload your code, diagrams, photos and datasheets so the whole team has them.</Empty>
      )}
    </Panel>
  );
}
