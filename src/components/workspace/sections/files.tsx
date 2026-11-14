"use client";

import { useMemo, useState } from "react";

import { deleteFileAction, renameFileFolderAction, setFileFolderAction } from "@/app/portal/workspace-actions";
import { FilesDropZone } from "@/components/workspace/file-upload";
import { InSitePdfModal } from "@/components/workspace/in-site-pdf";
import { fileUrl, useRun, useWs } from "@/components/workspace/ws-context";
import { BTN_DANGER, BTN_GHOST, BTN_SOFT, Empty, INPUT, Status } from "@/components/workspace/ws-ui";
import { formatStorageQuota } from "@/lib/portal/config";
import { FREE_PLAN_FILE_STORAGE_BYTES } from "@/lib/portal/storage-quota";
import { DEFAULT_FILE_FOLDER, FILE_FOLDER_MAX_LEN, FILE_FOLDERS, formatBytes } from "@/lib/workspace/constants";
import { formatDateTime } from "@/lib/workspace/dates";
import type { FileItem } from "@/lib/workspace/types";

const BOX = "border-dash-border border rounded-sm";
const BASE_GROUPS = [...FILE_FOLDERS];
const AFTER_MIN = ["Questionnaires", "Videos", "Images", "Audios"] as const;

function normalizeFolder(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, FILE_FOLDER_MAX_LEN);
}

function folderRank(name: string): [number, number, string] {
  if (name === "Project presentation (PPTs)" || /^Project presentation/i.test(name)) return [0, 0, name];
  const min = /^Min\s+(\d+)$/i.exec(name);
  if (min) return [1, Number(min[1]), name];
  const after = AFTER_MIN.indexOf(name as (typeof AFTER_MIN)[number]);
  if (after >= 0) return [2, after, name];
  return [3, 0, name];
}

function sortFolderNames(names: string[]) {
  return [...names].sort((a, b) => {
    const [a0, a1, a2] = folderRank(a);
    const [b0, b1, b2] = folderRank(b);
    if (a0 !== b0) return a0 - b0;
    if (a1 !== b1) return a1 - b1;
    return a2.localeCompare(b2, undefined, { sensitivity: "base" });
  });
}

function folderOf(f: FileItem) {
  return f.folder?.trim() || DEFAULT_FILE_FOLDER;
}

export function FilesSection({
  files,
  storageLimitBytes = FREE_PLAN_FILE_STORAGE_BYTES,
}: {
  files: FileItem[];
  storageLimitBytes?: number;
}) {
  const ctx = useWs();
  const { workspaceId, viewer } = ctx;
  const { run, pending, status } = useRun();
  const [q, setQ] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [pdfOpen, setPdfOpen] = useState<{ id: string; name: string } | null>(null);

  const limitBytes = storageLimitBytes > 0 ? storageLimitBytes : FREE_PLAN_FILE_STORAGE_BYTES;
  const used = useMemo(() => files.reduce((s, f) => s + f.size_bytes, 0), [files]);
  const usedPct = Math.min(100, Math.round((used / limitBytes) * 100));
  const limitLabel = formatStorageQuota(limitBytes);

  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of files) {
      const key = folderOf(f);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [files]);

  const folders = useMemo(() => {
    const set = new Set<string>([...BASE_GROUPS, ...extraFolders, ...folderCounts.keys()]);
    return sortFolderNames([...set]);
  }, [extraFolders, folderCounts]);

  const uploadFolder = folderFilter === "all" ? DEFAULT_FILE_FOLDER : folderFilter;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...files]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .filter((f) => {
        const folder = folderOf(f);
        if (folderFilter !== "all" && folder !== folderFilter) return false;
        if (!needle) return true;
        return f.name.toLowerCase().includes(needle) || folder.toLowerCase().includes(needle);
      });
  }, [files, q, folderFilter]);

  const groups = useMemo(() => {
    if (folderFilter !== "all") {
      return [{ folder: folderFilter, items: filtered }];
    }
    const map = new Map<string, FileItem[]>();
    for (const f of filtered) {
      const key = folderOf(f);
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    return sortFolderNames([...map.keys()]).map((folder) => ({ folder, items: map.get(folder)! }));
  }, [filtered, folderFilter]);

  function promptNewGroup(seed = ""): string | null {
    const raw = window.prompt("Group name (e.g. Min 1, Project feedbacks, CAD)", seed);
    if (raw == null) return null;
    const name = normalizeFolder(raw);
    if (!name) {
      window.alert("Enter a group name.");
      return null;
    }
    setExtraFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
    return name;
  }

  function addGroup() {
    const name = promptNewGroup();
    if (!name) return;
    setFolderFilter(name);
  }

  function renameActiveGroup() {
    if (folderFilter === "all") return;
    if (BASE_GROUPS.includes(folderFilter as (typeof FILE_FOLDERS)[number])) {
      window.alert("Built-in groups keep their name. Add a new group instead.");
      return;
    }
    const next = promptNewGroup(folderFilter);
    if (!next || next === folderFilter) return;
    const count = folderCounts.get(folderFilter) ?? 0;
    if (count === 0) {
      setExtraFolders((prev) => [...prev.filter((x) => x !== folderFilter), next]);
      setFolderFilter(next);
      return;
    }
    void run(() => renameFileFolderAction(workspaceId, folderFilter, next), {
      onOk: () => {
        setExtraFolders((prev) => [...prev.filter((x) => x !== folderFilter && x !== next), next]);
        setFolderFilter(next);
      },
    });
  }

  function moveFile(fileId: string, current: string, value: string) {
    if (value === "__new__") {
      const name = promptNewGroup();
      if (!name) return;
      void run(() => setFileFolderAction(workspaceId, fileId, name), {
        onOk: () => setFolderFilter(name),
      });
      return;
    }
    if (!value || value === current) return;
    void run(() => setFileFolderAction(workspaceId, fileId, value));
  }

  function isPdf(f: FileItem) {
    return f.mime_type === "application/pdf" || /\.pdf$/i.test(f.name);
  }

  function isImage(f: FileItem) {
    return Boolean(f.mime_type?.startsWith("image/")) || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name);
  }

  return (
    <div className="space-y-4">
      <div className="lg:grid lg:grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <aside className="space-y-3 lg:sticky lg:top-[5.25rem]">
          <div>
            <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">Work</p>
            <h2 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight">Project files</h2>
            <p className="text-dash-muted-foreground mt-1.5 text-sm leading-relaxed">
              Store files by group: presentation (PPTs), questionnaires, media, or add your own group.
            </p>
          </div>

          <div className={`${BOX} bg-dash-card/40 px-3 py-2.5`}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-dash-muted-foreground font-semibold tracking-wide uppercase">Storage</span>
              <span className="text-dash-foreground tabular-nums">
                {formatBytes(used)} / {limitLabel}
              </span>
            </div>
            <div className="bg-dash-muted mt-2 h-1 overflow-hidden">
              <div className="bg-dash-accent h-full transition-[width] duration-500" style={{ width: `${usedPct}%` }} />
            </div>
            <p className="text-dash-muted-foreground mt-1.5 text-xs">
              {files.length} file{files.length === 1 ? "" : "s"} · 25 MB max each · plan limit {limitLabel}
            </p>
          </div>

          <nav aria-label="File groups" className={`${BOX} bg-dash-card/40 overflow-hidden`}>
            <div className="border-dash-border space-y-2 border-b px-3 py-2.5">
              <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Groups</p>
              {viewer.canEdit ? (
                <button
                  type="button"
                  className={`${BTN_SOFT} w-full rounded-sm px-2.5 py-1.5 text-xs`}
                  onClick={addGroup}
                  disabled={pending}
                >
                  Add group
                </button>
              ) : null}
            </div>
            <ul className="divide-dash-border max-h-[22rem] divide-y overflow-y-auto">
              <li>
                <button
                  type="button"
                  onClick={() => setFolderFilter("all")}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition ${
                    folderFilter === "all"
                      ? "bg-dash-accent/12 border-l-dash-accent text-dash-foreground border-l-2 font-semibold"
                      : "text-dash-muted-foreground hover:bg-dash-muted/50 border-l-2 border-l-transparent"
                  }`}
                >
                  <span>All groups</span>
                  <span className="tabular-nums text-xs">{files.length}</span>
                </button>
              </li>
              {folders.map((folder) => {
                const n = folderCounts.get(folder) ?? 0;
                const on = folderFilter === folder;
                return (
                  <li key={folder}>
                    <button
                      type="button"
                      onClick={() => setFolderFilter(folder)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition ${
                        on
                          ? "bg-dash-accent/12 border-l-dash-accent text-dash-foreground border-l-2 font-semibold"
                          : "text-dash-muted-foreground hover:bg-dash-muted/50 border-l-2 border-l-transparent"
                      }`}
                    >
                      <span className="min-w-0 truncate" title={folder}>
                        {folder}
                      </span>
                      <span className="shrink-0 tabular-nums text-xs">{n}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {viewer.canEdit ? <FilesDropZone folder={uploadFolder} compact /> : null}
        </aside>

        <section className="mt-5 space-y-4 lg:mt-0">
          <div className="border-dash-border flex flex-wrap items-end justify-between gap-3 border-b pb-3">
            <div className="min-w-0">
              <h3 className="text-dash-foreground text-sm font-semibold tracking-tight">
                {folderFilter === "all" ? "All groups" : folderFilter}
              </h3>
              <p className="text-dash-muted-foreground text-xs">
                {filtered.length} file{filtered.length === 1 ? "" : "s"}
                {folderFilter !== "all"
                  ? ` · uploads go into “${folderFilter}”`
                  : ` · pick a group, or uploads go to “${DEFAULT_FILE_FOLDER}”`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {viewer.canEdit && folderFilter !== "all" && !/^Min\s+\d+$/i.test(folderFilter) && !BASE_GROUPS.includes(folderFilter as (typeof FILE_FOLDERS)[number]) ? (
                <button type="button" className={`${BTN_SOFT} rounded-sm text-xs`} disabled={pending} onClick={renameActiveGroup}>
                  Rename group
                </button>
              ) : null}
              {files.length ? (
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search files or groups"
                  className={`${INPUT} max-w-[16rem] rounded-sm`}
                  aria-label="Search files"
                />
              ) : null}
            </div>
          </div>

          <Status status={status} />

          {groups.some((g) => g.items.length) ? (
            <div className="space-y-5">
              {groups.map((group) =>
                group.items.length ? (
                  <div key={group.folder}>
                    {folderFilter === "all" ? (
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <button
                          type="button"
                          className="text-dash-foreground text-xs font-semibold tracking-wide uppercase hover:underline"
                          onClick={() => setFolderFilter(group.folder)}
                        >
                          {group.folder}
                        </button>
                        <span className="text-dash-muted-foreground text-[11px] tabular-nums">{group.items.length}</span>
                      </div>
                    ) : null}
                    <ul className={`${BOX} divide-dash-border bg-dash-card/30 divide-y overflow-hidden`}>
                      {group.items.map((f) => {
                        const pdf = isPdf(f);
                        const image = isImage(f);
                        const openHref = fileUrl(ctx, f.id, true);
                        const downloadHref = fileUrl(ctx, f.id);
                        const currentFolder = folderOf(f);
                        return (
                          <li key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                            <FileKindIcon name={f.name} mime={f.mime_type} />
                            <div className="min-w-0 flex-1">
                              {pdf ? (
                                <button
                                  type="button"
                                  onClick={() => setPdfOpen({ id: f.id, name: f.name })}
                                  className="text-dash-foreground block w-full truncate text-left text-sm font-semibold hover:underline"
                                >
                                  {f.name}
                                </button>
                              ) : (
                                <a
                                  href={image ? openHref : downloadHref}
                                  target={image ? "_blank" : undefined}
                                  rel={image ? "noreferrer" : undefined}
                                  className="text-dash-foreground block truncate text-sm font-semibold hover:underline"
                                >
                                  {f.name}
                                </a>
                              )}
                              <p className="text-dash-muted-foreground mt-0.5 truncate text-xs">
                                {formatBytes(f.size_bytes)}
                                <span className="mx-1 opacity-40">·</span>
                                {formatDateTime(f.created_at)}
                                {folderFilter === "all" ? (
                                  <>
                                    <span className="mx-1 opacity-40">·</span>
                                    {currentFolder}
                                  </>
                                ) : null}
                                {f.obtained_place ? (
                                  <>
                                    <span className="mx-1 opacity-40">·</span>
                                    Obtained: {f.obtained_place}
                                  </>
                                ) : null}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                              {viewer.canEdit ? (
                                <select
                                  id={`move-${f.id}`}
                                  value={currentFolder}
                                  disabled={pending}
                                  onChange={(e) => moveFile(f.id, currentFolder, e.target.value)}
                                  className={`${INPUT} max-w-[12rem] rounded-sm py-1.5 text-xs`}
                                  aria-label={`Move ${f.name} to group`}
                                >
                                  {folders.map((folder) => (
                                    <option key={folder} value={folder}>
                                      {folder}
                                    </option>
                                  ))}
                                  <option value="__new__">New group…</option>
                                </select>
                              ) : null}
                              {pdf ? (
                                <button
                                  type="button"
                                  className={`${BTN_SOFT} rounded-sm`}
                                  onClick={() => setPdfOpen({ id: f.id, name: f.name })}
                                >
                                  Open
                                </button>
                              ) : image ? (
                                <a href={openHref} target="_blank" rel="noreferrer" className={`${BTN_SOFT} rounded-sm`}>
                                  Open
                                </a>
                              ) : (
                                <a href={downloadHref} className={`${BTN_SOFT} rounded-sm`}>
                                  Open
                                </a>
                              )}
                              <a href={downloadHref} className={BTN_GHOST}>
                                Download
                              </a>
                              {viewer.canEdit ? (
                                <button
                                  type="button"
                                  className={BTN_DANGER}
                                  disabled={pending}
                                  onClick={() => {
                                    if (window.confirm(`Delete "${f.name}"?`)) {
                                      void run(() => deleteFileAction(workspaceId, f.id));
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <Empty
              title={
                files.length
                  ? "No files match"
                  : folderFilter === "all"
                    ? "No project files yet"
                    : `Nothing in “${folderFilter}” yet`
              }
            >
              {files.length
                ? "Try another search or group."
                : viewer.canEdit
                  ? folderFilter === "all"
                    ? `Upload into “${DEFAULT_FILE_FOLDER}”, or open a group first.`
                    : `Upload into “${folderFilter}”, or move files here from another group.`
                  : "When your team uploads project files, they will show up here."}
            </Empty>
          )}
        </section>
      </div>

      <InSitePdfModal
        open={Boolean(pdfOpen)}
        url={pdfOpen ? fileUrl(ctx, pdfOpen.id, true) : null}
        title={pdfOpen?.name ?? "PDF"}
        onClose={() => setPdfOpen(null)}
      />
    </div>
  );
}

function FileKindIcon({ mime, name }: { mime: string | null; name: string }) {
  const kind =
    mime?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
      ? "image"
      : mime?.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/i.test(name)
        ? "video"
        : mime?.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(name)
          ? "audio"
          : /\.(ppt|pptx|key)$/i.test(name)
            ? "slides"
            : mime === "application/pdf" || /\.pdf$/i.test(name)
              ? "pdf"
              : /\.(doc|docx)$/i.test(name)
                ? "doc"
                : "file";

  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm ${
        kind === "pdf"
          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
          : kind === "doc"
            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
            : kind === "slides"
              ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
              : kind === "image"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : kind === "video"
                  ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : kind === "audio"
                    ? "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
                    : "bg-dash-muted text-dash-foreground"
      }`}
      aria-hidden
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    </span>
  );
}
