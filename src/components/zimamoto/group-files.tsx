"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  portalZimamotoCreateFolderAction,
  portalZimamotoFileRemoveAction,
  portalZimamotoFilesAction,
  portalZimamotoFileUpdateAction,
} from "@/app/portal/zimamoto-chat-actions";
import type { ZimamotoFile, ZimamotoFileLibrary } from "@/lib/portal/zimamoto-files";
import { fileFamilyKey } from "@/lib/portal/zimamoto-file-utils";

type TypeFilter = "all" | "docs" | "slides" | "data" | "images" | "other";
type Sort = "newest" | "oldest" | "name" | "size" | "uploader";
type FolderFilter = "all" | "pinned" | "unfiled" | string;

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All",
  docs: "Documents",
  slides: "Slides",
  data: "Data",
  images: "Images",
  other: "Other",
};

export function fileTypeOf(name: string): Exclude<TypeFilter, "all"> {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (["pdf", "doc", "docx", "txt", "md", "rtf", "odt"].includes(ext)) return "docs";
  if (["ppt", "pptx", "key", "odp"].includes(ext)) return "slides";
  if (["csv", "xls", "xlsx", "ods", "json", "sav", "dta"].includes(ext)) return "data";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"].includes(ext)) return "images";
  return "other";
}

function iconFor(type: ReturnType<typeof fileTypeOf>): string {
  return { docs: "📄", slides: "📊", data: "🧮", images: "🖼️", other: "📎" }[type];
}

export function GroupFiles({
  groupId,
  focusKey,
  onFocusDone,
}: {
  groupId: string;
  /** `message:<id>` or `doc:<publicId>` to scroll to and highlight. */
  focusKey: string | null;
  onFocusDone: () => void;
}) {
  const [library, setLibrary] = useState<ZimamotoFileLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [folder, setFolder] = useState<FolderFilter>("all");
  const [newFolder, setNewFolder] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reload() {
    return portalZimamotoFilesAction(groupId).then((res) => {
      if (res.ok && res.library) {
        setLibrary(res.library);
        setError(null);
      } else {
        setError(res.message ?? "Could not load files.");
      }
    });
  }

  useEffect(() => {
    let alive = true;
    portalZimamotoFilesAction(groupId).then((res) => {
      if (!alive) return;
      if (res.ok && res.library) setLibrary(res.library);
      else setError(res.message ?? "Could not load files.");
    });
    return () => {
      alive = false;
    };
  }, [groupId]);

  // Jump from a chat bubble: clear filters so the file is visible, then scroll and highlight it.
  useEffect(() => {
    if (!focusKey || !library) return;
    const t = setTimeout(() => document.getElementById(`file-${focusKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    const clear = setTimeout(() => {
      onFocusDone();
    }, 2600);
    return () => {
      clearTimeout(t);
      clearTimeout(clear);
    };
  }, [focusKey, library, onFocusDone]);

  // While a jump is active the view shows everything, so the target is always visible.
  const effQuery = focusKey ? "" : query;
  const effType = focusKey ? "all" : type;
  const effFolder = focusKey ? "all" : folder;

  const visible = useMemo(() => {
    if (!library) return [];
    const q = effQuery.trim().toLowerCase();
    let list = library.files.filter((f) => {
      if (effFolder === "pinned" && !f.pinned) return false;
      if (effFolder === "unfiled" && f.folderId) return false;
      if (effFolder !== "all" && effFolder !== "pinned" && effFolder !== "unfiled" && f.folderId !== effFolder) return false;
      if (effType !== "all" && fileTypeOf(f.fileName) !== effType) return false;
      if (q && !f.fileName.toLowerCase().includes(q) && !f.uploaderName.toLowerCase().includes(q)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: ZimamotoFile, b: ZimamotoFile) => number> = {
      newest: (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
      oldest: (a, b) => (a.createdAt < b.createdAt ? -1 : 1),
      name: (a, b) => a.fileName.localeCompare(b.fileName),
      size: (a, b) => b.sizeBytes - a.sizeBytes,
      uploader: (a, b) => a.uploaderName.localeCompare(b.uploaderName),
    };
    // Pinned files stay on top unless the user is looking at one folder or a search.
    list = [...list].sort((a, b) => (effFolder === "all" && !q && a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : cmp[sort](a, b)));
    return list;
  }, [library, effQuery, effType, effFolder, sort]);

  function act(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setNotice(null);
    start(async () => {
      const res = await fn();
      setNotice(res.message ?? null);
      await reload();
    });
  }

  function copyLink(f: ZimamotoFile) {
    const url = `${window.location.origin}/api/portal/zimamoto/file?kind=${f.kind === "message" ? "message" : "doc"}&id=${f.key}`;
    void navigator.clipboard?.writeText(url);
    setNotice("Link copied.");
  }

  if (error) return <p className="text-dash-muted-foreground p-6 text-sm">{error}</p>;
  if (!library) return <p className="text-dash-muted-foreground p-6 text-sm">Loading files…</p>;

  const usedPct = Math.min(100, Math.round((library.usedBytes / library.limitBytes) * 100));
  const folderName = (id: string | null) => library.folders.find((x) => x.id === id)?.name ?? "Unfiled";

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-5">
      {/* Storage */}
      <div className="border-dash-border bg-dash-canvas/50 rounded-2xl border p-4">
        <div className="text-dash-muted-foreground flex justify-between text-xs">
          <span>
            {formatBytes(library.usedBytes)} of {formatBytes(library.limitBytes)} used
          </span>
          <span>{library.files.length} file{library.files.length === 1 ? "" : "s"}</span>
        </div>
        <div className="bg-dash-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
          <div className="bg-dash-accent h-full rounded-full" style={{ width: `${usedPct}%` }} />
        </div>
      </div>

      {/* Search, type, sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by file name or uploader"
          className="border-dash-border bg-dash-canvas text-dash-foreground placeholder:text-dash-muted-foreground flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-dash-accent/25"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="border-dash-border bg-dash-canvas text-dash-foreground rounded-xl border px-3 py-2.5 text-sm">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="size">Largest first</option>
          <option value="uploader">Uploader</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${type === t ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground hover:text-dash-foreground"}`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Folders */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "all", label: "All files" },
          { id: "pinned", label: "★ Pinned" },
          { id: "unfiled", label: "Unfiled" },
          ...library.folders.map((f) => ({ id: f.id, label: `${f.name} (${f.fileCount})` })),
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFolder(c.id)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${folder === c.id ? "border-dash-accent text-dash-accent" : "border-dash-border text-dash-muted-foreground hover:text-dash-foreground"}`}
          >
            {c.label}
          </button>
        ))}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newFolder.trim();
            if (!name) return;
            start(async () => {
              const res = await portalZimamotoCreateFolderAction({ groupId, name });
              setNotice(res.message ?? null);
              if (res.ok) setNewFolder("");
              await reload();
            });
          }}
        >
          <input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            maxLength={60}
            placeholder="New folder"
            className="border-dash-border bg-dash-canvas text-dash-foreground w-36 rounded-xl border px-3 py-1.5 text-xs outline-none"
          />
          <button type="submit" disabled={pending || !newFolder.trim()} className="text-dash-accent text-xs font-semibold disabled:opacity-50">
            + Add
          </button>
        </form>
      </div>

      {notice ? <p className="text-dash-muted-foreground text-xs">{notice}</p> : null}

      {/* List */}
      {visible.length === 0 ? (
        <p className="text-dash-muted-foreground border-dash-border rounded-2xl border border-dashed p-8 text-center text-sm">
          {library.files.length === 0 ? "No files yet. Attach one in the chat and it will be kept here." : "No files match these filters."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((f) => {
            const key = `${f.kind === "message" ? "message" : "doc"}:${f.key}`;
            const type = fileTypeOf(f.fileName);
            const href = `/api/portal/zimamoto/file?kind=${f.kind === "message" ? "message" : "doc"}&id=${f.key}`;
            return (
              <li
                key={key}
                id={`file-${key}`}
                className={`border-dash-border bg-dash-card flex flex-col gap-3 rounded-2xl border p-4 transition sm:flex-row sm:items-center ${focusKey === key ? "ring-dash-accent ring-2" : ""}`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="text-2xl leading-none" aria-hidden>
                    {iconFor(type)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-dash-foreground flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="truncate">{f.fileName}</span>
                      {f.pinned ? <span className="text-amber-500" title="Pinned">★</span> : null}
                      {f.versionCount > 1 ? (
                        <span className="bg-dash-muted text-dash-muted-foreground rounded px-1.5 py-0.5 text-[10px]" title={`Version ${f.version} of ${f.versionCount} (${fileFamilyKey(f.fileName)})`}>
                          v{f.version}
                        </span>
                      ) : null}
                      {f.kind === "doc" ? <span className="bg-dash-accent/10 text-dash-accent rounded px-1.5 py-0.5 text-[10px]">Saved</span> : null}
                    </p>
                    <p className="text-dash-muted-foreground mt-0.5 text-xs">
                      {folderName(f.folderId)} · {formatBytes(f.sizeBytes)} · {f.uploaderName} · {formatDate(f.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <a href={href} target="_blank" rel="noreferrer" className="text-dash-accent">Open</a>
                  <a href={`${href}&download=1`} className="text-dash-accent">Download</a>
                  <button type="button" onClick={() => copyLink(f)} className="text-dash-muted-foreground hover:text-dash-foreground">Copy link</button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(() => portalZimamotoFileUpdateAction({ groupId, kind: f.kind, key: f.key, pinned: !f.pinned }))}
                    className="text-dash-muted-foreground hover:text-dash-foreground disabled:opacity-50"
                  >
                    {f.pinned ? "Unpin" : "Pin"}
                  </button>
                  <select
                    aria-label="Move to folder"
                    value={f.folderId ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      act(() =>
                        portalZimamotoFileUpdateAction({ groupId, kind: f.kind, key: f.key, folderId: e.target.value || null }),
                      )
                    }
                    className="border-dash-border bg-dash-canvas text-dash-foreground rounded-lg border px-2 py-1 text-xs"
                  >
                    <option value="">Unfiled</option>
                    {library.folders.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  {f.canManage ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Remove "${f.fileName}" for everyone in this group? The stored copy is kept.`)) {
                          act(() => portalZimamotoFileRemoveAction({ groupId, kind: f.kind, key: f.key }));
                        }
                      }}
                      className="text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
