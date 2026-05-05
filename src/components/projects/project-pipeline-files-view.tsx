"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { SharePreviewLink } from "@/components/share/share-preview-link";
import { canPreviewInBrowser } from "@/lib/drive-preview-helpers";
import type { ProjectPipelineActivityFiles } from "@/lib/project-pipeline-files";

function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-dash-accent/30 border-t-dash-accent" aria-hidden />
      {label}
    </span>
  );
}

function formatBytes(size: string | null): string {
  if (!size) return "—";
  const n = Number(size);
  if (Number.isNaN(n)) return size;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectPipelineFilesViewSection({
  projectId,
  activities,
  shareToken,
  shareClientSlug,
  sectionId,
}: {
  projectId: string;
  activities: ProjectPipelineActivityFiles[];
  /** When set, links stay on the public share host (no internal app URLs). */
  shareToken?: string;
  /** With `shareToken`, path is `/share/{slug}/{token}/…`. */
  shareClientSlug?: string;
  /** Anchor id for in-page navigation (e.g. public share page). */
  sectionId?: string;
}) {
  const pathname = usePathname();
  const encToken = shareToken ? encodeURIComponent(shareToken) : "";
  const encSlug = shareClientSlug ? encodeURIComponent(shareClientSlug) : "";
  const shareBase =
    shareToken && shareClientSlug ? `/share/${encSlug}/${encToken}` : shareToken ? `/share/${encToken}` : "";
  const previewHref = (fileId: string) =>
    shareToken && shareClientSlug
      ? `${shareBase}/view/${encodeURIComponent(fileId)}`
      : shareToken
        ? `/share/${encToken}/view/${encodeURIComponent(fileId)}`
        : `/drive/view/${encodeURIComponent(fileId)}`;
  const downloadHref = (fileId: string) =>
    shareToken
      ? `/api/share/${encToken}/file/${encodeURIComponent(fileId)}?download=1`
      : `/api/drive/file/${encodeURIComponent(fileId)}?download=1`;

  const bottomMargin = shareToken ? "mb-4 sm:mb-5" : "mb-10 sm:mb-12";
  const sharePreview = Boolean(shareToken && shareClientSlug);
  const [openActivityKey, setOpenActivityKey] = useState<string | null>(activities[0]?.key ?? null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<Record<string, { loading: boolean; percent: number | null }>>({});

  const storageKey = useMemo(() => `pipelineFilesState:${pathname}:${sectionId ?? "default"}`, [pathname, sectionId]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { openActivityKey?: string; scrollY?: number };
      if (parsed.openActivityKey && activities.some((a) => a.key === parsed.openActivityKey)) {
        setOpenActivityKey(parsed.openActivityKey);
      }
      if (typeof parsed.scrollY === "number" && Number.isFinite(parsed.scrollY) && parsed.scrollY >= 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => window.scrollTo({ top: parsed.scrollY, behavior: "auto" }));
        });
      }
    } catch {
      /* ignore storage parse errors */
    }
  }, [activities, storageKey]);

  function rememberUiState(nextOpenActivityKey: string | null = openActivityKey) {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          openActivityKey: nextOpenActivityKey,
          scrollY: window.scrollY,
        }),
      );
    } catch {
      /* ignore storage quota errors */
    }
  }

  function beginPreviewLoad(fileId: string, activityKey: string) {
    setPreviewLoadingId(fileId);
    rememberUiState(activityKey);
    window.setTimeout(() => {
      setPreviewLoadingId((curr) => (curr === fileId ? null : curr));
    }, 5000);
  }

  async function downloadWithProgress(fileId: string, fileName: string) {
    setDownloadState((prev) => ({ ...prev, [fileId]: { loading: true, percent: 0 } }));
    rememberUiState();
    try {
      const res = await fetch(downloadHref(fileId));
      if (!res.ok) throw new Error("Download failed.");

      const total = Number(res.headers.get("content-length") ?? "0");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Download stream unavailable.");

      const chunks: BlobPart[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
          received += value.length;
          if (total > 0) {
            const percent = Math.min(100, Math.round((received / total) * 100));
            setDownloadState((prev) => ({ ...prev, [fileId]: { loading: true, percent } }));
          } else {
            setDownloadState((prev) => ({ ...prev, [fileId]: { loading: true, percent: null } }));
          }
        }
      }

      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setDownloadState((prev) => ({ ...prev, [fileId]: { loading: false, percent: 100 } }));
      setTimeout(() => {
        setDownloadState((prev) => {
          const next = { ...prev };
          delete next[fileId];
          return next;
        });
      }, 500);
    } catch {
      setDownloadState((prev) => ({ ...prev, [fileId]: { loading: false, percent: null } }));
    }
  }

  return (
    <section
      id={sectionId}
      className={`border-dash-border bg-dash-card scroll-mt-28 rounded-3xl border p-5 shadow-sm sm:p-6 sm:shadow-md ${bottomMargin}`}
      aria-labelledby="pipeline-files-heading"
    >
      <h2 id="pipeline-files-heading" className="text-dash-foreground mb-1 text-lg font-bold tracking-tight sm:text-xl">
        Files by pipeline activity
      </h2>
      <p className="text-dash-muted-foreground mb-6 max-w-2xl text-sm leading-relaxed">
        {shareToken ? (
          <>
            Use Preview to view image and video, or Download files. Everything here is for this project only.{" "}
            <span className="text-dash-foreground font-medium">Pipeline documents</span> appears after{" "}
            <span className="text-dash-foreground font-medium">Full project test</span>: optional folder in the project
            Drive root (exact name) for specs and files that apply across steps.
          </>
        ) : (
          <>
            After <span className="text-dash-foreground font-medium">Full project test</span>,{" "}
            <span className="text-dash-foreground font-medium">Pipeline documents</span> lists files from an optional
            folder with that exact name under the project Drive root (cross-cutting specs and PDFs). Other groups match
            each pipeline step (same as Manage uploads). Preview appears only when the file type can open in-app;
            otherwise use Download. Open the full{" "}
            <Link href={`/projects/${projectId}/files`} className="text-dash-accent font-medium underline-offset-2 hover:underline">
              project Files
            </Link>{" "}
            browser.
          </>
        )}
      </p>

      <div className="space-y-3 sm:space-y-4">
        {activities.map((a) => (
          <details
            key={a.key}
            open={openActivityKey === a.key}
            onToggle={(e) => {
              const isOpen = (e.currentTarget as HTMLDetailsElement).open;
              const next = isOpen ? a.key : null;
              setOpenActivityKey(next);
              rememberUiState(next);
            }}
            className={`group rounded-2xl border transition-colors ${
              openActivityKey === a.key
                ? "border-emerald-500/45 bg-emerald-500/10"
                : "border-dash-border bg-dash-muted/10 open:bg-dash-muted/25"
            }`}
          >
            <summary className="text-dash-foreground flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-dash-muted/30 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block truncate">{a.label}</span>
                <span className="text-dash-muted-foreground mt-0.5 block text-xs font-normal tabular-nums">
                  {a.files.length} file{a.files.length === 1 ? "" : "s"}
                </span>
              </span>
              <span
                className="text-dash-muted-foreground shrink-0 rounded-full border border-transparent bg-dash-card/80 px-2 py-1 text-xs font-normal transition-transform group-open:rotate-180"
                aria-hidden
              >
                ▼
              </span>
            </summary>
            <div className="border-dash-border border-t px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
              {a.listError ? (
                <p className="text-red-600 dark:text-red-300 px-1 py-2 text-sm" role="alert">
                  {a.listError}
                </p>
              ) : a.files.length === 0 ? (
                <p className="text-dash-muted-foreground px-1 py-3 text-sm">
                  No files in this activity folder yet
                  {!a.folderId ? " (folder appears after first upload or attach from Manage / Files)" : ""}.
                </p>
              ) : (
                <>
                  <ul className="flex flex-col gap-2.5 sm:hidden">
                    {a.files.map((f) => (
                      <li key={f.id} className="border-dash-border bg-dash-card/70 rounded-2xl border p-4 shadow-sm">
                        <div className="flex flex-col gap-3">
                          <div className="min-w-0">
                            <p className="text-dash-foreground text-sm font-semibold leading-snug break-words">{f.name}</p>
                            <p className="text-dash-muted-foreground mt-1 text-xs tabular-nums">{formatBytes(f.size)}</p>
                          </div>
                          <div className="border-dash-border bg-dash-muted/25 relative rounded-xl border p-2">
                            <div
                              className={`flex flex-wrap justify-center gap-2 transition ${previewLoadingId === f.id || downloadState[f.id]?.loading ? "pointer-events-none blur-[1px] opacity-65" : ""}`}
                            >
                              {canPreviewInBrowser(f.mimeType, f.name) ? (
                                sharePreview ? (
                                  <SharePreviewLink
                                    href={previewHref(f.id)}
                                    onClick={() => beginPreviewLoad(f.id, a.key)}
                                    className="border-dash-border bg-dash-accent/10 text-dash-accent-dim hover:bg-dash-accent/20 focus-visible:ring-dash-accent inline-flex min-h-11 min-w-[6.5rem] flex-1 items-center justify-center rounded-xl border text-center text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                  >
                                    Preview
                                  </SharePreviewLink>
                                ) : (
                                  <Link
                                    href={previewHref(f.id)}
                                    onClick={() => beginPreviewLoad(f.id, a.key)}
                                    className="border-dash-border bg-dash-accent/10 text-dash-accent-dim hover:bg-dash-accent/20 focus-visible:ring-dash-accent inline-flex min-h-11 min-w-[6.5rem] flex-1 items-center justify-center rounded-xl border text-center text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                  >
                                    Preview
                                  </Link>
                                )
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void downloadWithProgress(f.id, f.name)}
                                disabled={downloadState[f.id]?.loading}
                                className="border-dash-border bg-dash-card text-dash-foreground hover:border-dash-accent/35 focus-visible:ring-dash-accent inline-flex min-h-11 min-w-[6.5rem] flex-1 items-center justify-center rounded-xl border text-center text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                              >
                                Download
                              </button>
                            </div>
                            {previewLoadingId === f.id ? (
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                                <Spinner label="Opening preview..." />
                              </div>
                            ) : downloadState[f.id]?.loading ? (
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                                <Spinner
                                  label={
                                    downloadState[f.id]?.percent == null
                                      ? "Downloading..."
                                      : `Downloading ${downloadState[f.id]?.percent}%`
                                  }
                                />
                              </div>
                            ) : null}
                          </div>
                          {downloadState[f.id] ? (
                            <div className="space-y-1">
                              <div className="bg-dash-muted h-1.5 w-full overflow-hidden rounded-full">
                                <div
                                  className="bg-dash-accent h-full transition-all"
                                  style={{ width: `${downloadState[f.id]?.percent ?? 35}%` }}
                                />
                              </div>
                              <p className="text-dash-muted-foreground text-[11px]">
                                {downloadState[f.id]?.percent == null
                                  ? "Downloading..."
                                  : `Downloading ${downloadState[f.id]?.percent}%`}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="divide-dash-border min-w-full divide-y text-sm">
                      <thead>
                        <tr className="text-dash-muted-foreground text-left text-xs font-semibold uppercase">
                          <th className="px-2 py-2">Name</th>
                          <th className="hidden px-2 py-2 md:table-cell">Size</th>
                          <th className="px-2 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-dash-border divide-y">
                        {a.files.map((f) => (
                          <tr key={f.id} className="hover:bg-dash-muted/40">
                            <td className="text-dash-foreground max-w-[min(40vw,320px)] truncate px-2 py-2.5 font-medium md:max-w-md">
                              {f.name}
                            </td>
                            <td className="text-dash-muted-foreground hidden px-2 py-2.5 text-xs tabular-nums md:table-cell">
                              {formatBytes(f.size)}
                            </td>
                            <td className="px-2 py-2.5 text-right">
                              <div className="border-dash-border bg-dash-muted/25 relative ml-auto inline-flex rounded-lg border px-2 py-1.5">
                                <div
                                  className={`flex flex-wrap items-center justify-end gap-x-3 gap-y-1 transition ${previewLoadingId === f.id || downloadState[f.id]?.loading ? "pointer-events-none blur-[1px] opacity-65" : ""}`}
                                >
                                {canPreviewInBrowser(f.mimeType, f.name) ? (
                                  sharePreview ? (
                                    <SharePreviewLink
                                      href={previewHref(f.id)}
                                      onClick={() => beginPreviewLoad(f.id, a.key)}
                                      className="text-dash-accent hover:text-dash-accent-dim text-xs font-semibold underline-offset-2 hover:underline"
                                    >
                                      Preview
                                    </SharePreviewLink>
                                  ) : (
                                    <Link
                                      href={previewHref(f.id)}
                                      onClick={() => beginPreviewLoad(f.id, a.key)}
                                      className="text-dash-accent hover:text-dash-accent-dim text-xs font-semibold underline-offset-2 hover:underline"
                                    >
                                      Preview
                                    </Link>
                                  )
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void downloadWithProgress(f.id, f.name)}
                                  disabled={downloadState[f.id]?.loading}
                                  className="text-dash-accent hover:text-dash-accent-dim text-xs font-semibold underline-offset-2 hover:underline"
                                >
                                  {downloadState[f.id]?.loading
                                    ? `Downloading${downloadState[f.id]?.percent != null ? ` ${downloadState[f.id]?.percent}%` : "..."}`
                                    : "Download"}
                                </button>
                              </div>
                                {previewLoadingId === f.id || downloadState[f.id]?.loading ? (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                                    <Spinner
                                      label={
                                        previewLoadingId === f.id
                                          ? "Opening preview..."
                                          : downloadState[f.id]?.percent == null
                                            ? "Downloading..."
                                            : `Downloading ${downloadState[f.id]?.percent}%`
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
