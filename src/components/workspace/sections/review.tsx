"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  addReviewMarkAction,
  deleteFileAction,
  deleteItemAction,
  deleteReviewMarkAction,
  pruneEmptySectionDocsAction,
  saveItemAction,
  setDocumentSharedAction,
  splitDocumentPartialAction,
  startReviewFromFileAction,
} from "@/app/portal/workspace-actions";
import { CommentsThread } from "@/components/workspace/comments";
import { FileUploadButton } from "@/components/workspace/file-upload";
import { ReviewPaper } from "@/components/workspace/review-paper";
import { fileUrl, useRun, useWs, tabHref } from "@/components/workspace/ws-context";
import { Badge, BTN, BTN_DANGER, BTN_GHOST, BTN_SOFT, INPUT, Label, Status } from "@/components/workspace/ws-ui";
import { DOCUMENT_STATUSES, DEFAULT_FILE_FOLDER, formatBytes, tone } from "@/lib/workspace/constants";
import { formatDateTime } from "@/lib/workspace/dates";
import { isLegacyEmptySectionName } from "@/lib/workspace/templates";
import type { DocumentItem, FileItem, ReviewMark, WorkspaceBundle } from "@/lib/workspace/types";
import { isPdfFileName, isReviewableFile, isWordFile } from "@/lib/workspace/review-files";

const BOX = "border-dash-border border rounded-none";
const BOX_PAD = `${BOX} bg-dash-card/40 p-3 sm:p-4`;

function isPdfFile(f: FileItem) {
  return isPdfFileName(f.name, f.mime_type);
}

function isWordSource(f: FileItem) {
  return isWordFile(f.name, f.mime_type);
}

/** Prefer one row per document: PDF over Word when both are linked. */
function pickReviewSources(files: FileItem[]): FileItem[] {
  const reviewable = files.filter((f) => isReviewableFile(f.name, f.mime_type));
  const byDoc = new Map<string, FileItem>();
  const unlinked: FileItem[] = [];
  for (const f of reviewable) {
    if (!f.document_id) {
      unlinked.push(f);
      continue;
    }
    const prev = byDoc.get(f.document_id);
    if (!prev) {
      byDoc.set(f.document_id, f);
      continue;
    }
    if (isPdfFile(f) && !isPdfFile(prev)) byDoc.set(f.document_id, f);
  }
  return [...byDoc.values(), ...unlinked];
}

export function ReviewSection({ bundle, printHref }: { bundle: WorkspaceBundle; printHref: string }) {
  const router = useRouter();
  const { workspaceId, viewer, basePath } = useWs();
  const { run, pending, status } = useRun();
  const pruned = useRef(false);

  const withFile = useMemo(
    () => new Set(bundle.files.map((f) => f.document_id).filter((id): id is string => Boolean(id))),
    [bundle.files],
  );

  const reviewFiles = useMemo(() => {
    const sharedDocIds = new Set(
      bundle.documents.filter((d) => d.shared_with_supervisor).map((d) => d.id),
    );
    return pickReviewSources(bundle.files)
      .filter((f) => {
        if (viewer.kind !== "supervisor") return true;
        return Boolean(f.document_id && sharedDocIds.has(f.document_id));
      })
      .sort((a, b) => {
        const fa = (a.folder || DEFAULT_FILE_FOLDER).localeCompare(b.folder || DEFAULT_FILE_FOLDER);
        if (fa !== 0) return fa;
        return String(b.created_at).localeCompare(String(a.created_at));
      });
  }, [bundle.documents, bundle.files, viewer.kind]);

  const pdfsByFolder = useMemo(() => {
    const map = new Map<string, FileItem[]>();
    for (const f of reviewFiles) {
      const key = f.folder?.trim() || DEFAULT_FILE_FOLDER;
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [reviewFiles]);

  const docs = useMemo(() => {
    return bundle.documents.filter((d) => {
      if (d.parent_id) return true;
      if (isLegacyEmptySectionName(d.name) && !withFile.has(d.id)) return false;
      return true;
    });
  }, [bundle.documents, withFile]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, DocumentItem[]>();
    for (const d of docs) {
      if (!d.parent_id) continue;
      const list = map.get(d.parent_id) ?? [];
      list.push(d);
      map.set(d.parent_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.page_from ?? 0) - (b.page_from ?? 0) || a.name.localeCompare(b.name));
    }
    return map;
  }, [docs]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const rootId = selected ? selected.parent_id ?? selected.id : null;
  const rootPartials = rootId ? childrenByParent.get(rootId) ?? [] : [];
  const sharedCount = docs.filter((d) => d.shared_with_supervisor).length;

  const filteredFolders = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return pdfsByFolder;
    return pdfsByFolder
      .map(([folder, items]) => {
        const matched = items.filter(
          (f) => f.name.toLowerCase().includes(needle) || folder.toLowerCase().includes(needle),
        );
        return [folder, matched] as const;
      })
      .filter(([, items]) => items.length > 0);
  }, [pdfsByFolder, q]);

  useEffect(() => {
    if (!viewer.canEdit || pruned.current) return;
    const hasLegacy = bundle.documents.some(
      (d) => !d.parent_id && !withFile.has(d.id) && isLegacyEmptySectionName(d.name),
    );
    if (!hasLegacy) return;
    pruned.current = true;
    void pruneEmptySectionDocsAction(workspaceId).then((res) => {
      if (res.ok && (res.data?.removed ?? 0) > 0) router.refresh();
    });
  }, [bundle.documents, router, viewer.canEdit, withFile, workspaceId]);

  // Prefer a previously opened file / document once files load.
  useEffect(() => {
    if (selectedId && docs.some((d) => d.id === selectedId)) return;
    if (selectedFileId) {
      const f = reviewFiles.find((x) => x.id === selectedFileId);
      if (f?.document_id && docs.some((d) => d.id === f.document_id)) {
        setSelectedId(f.document_id);
        return;
      }
    }
    const firstLinked = reviewFiles.find((f) => f.document_id && docs.some((d) => d.id === f.document_id));
    if (firstLinked?.document_id) {
      setSelectedId(firstLinked.document_id);
      setSelectedFileId(firstLinked.id);
    }
  }, [docs, reviewFiles, selectedFileId, selectedId]);

  function openFile(f: FileItem) {
    setSelectedFileId(f.id);
    if (f.document_id && docs.some((d) => d.id === f.document_id)) {
      setSelectedId(f.document_id);
      return;
    }
    void run(() => startReviewFromFileAction(workspaceId, f.id), {
      onOk: (data) => {
        if (data?.documentId) setSelectedId(data.documentId);
      },
    });
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">Work</p>
          <h2 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight">Review</h2>
          <p className="text-dash-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
            {viewer.kind === "supervisor"
              ? "Select a shared file, open the paper, and pin notes on the exact spot."
              : "Select a PDF or Word file from Project files to review, mark, share, and collect feedback."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewer.canEdit ? (
            <Link href={tabHref(basePath, "files")} className={`${BTN_SOFT} rounded-none px-3 py-1.5 text-xs`}>
              Project files
            </Link>
          ) : null}
          {viewer.kind !== "supervisor" ? (
            <Link href={printHref} target="_blank" className={`${BTN_GHOST} ${BOX} px-3 py-1.5`}>
              Print change summary
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-px sm:grid-cols-3">
        <Stat label="Files available" value={reviewFiles.length} />
        <Stat label="Shared with supervisor" value={sharedCount} />
        <Stat label="Waiting for feedback" value={docs.filter((d) => d.status === "submitted").length} />
      </div>

      <Status status={status} />

      {!reviewFiles.length ? (
        <div className={BOX_PAD}>
          <p className="text-dash-foreground text-sm font-semibold">No files to review yet</p>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            {viewer.kind === "supervisor"
              ? "Ask the student to upload a PDF or Word file in Project files and turn on Share."
              : "Upload a PDF or Word (.doc / .docx) under Project files, then select it here. Word is converted to PDF for markup."}
          </p>
          {viewer.canEdit ? (
            <Link href={tabHref(basePath, "files")} className={`${BTN} mt-3 inline-flex rounded-none`}>
              Go to Project files
            </Link>
          ) : null}
        </div>
      ) : (
        <div className={`${BOX} grid overflow-hidden lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]`}>
          <aside className="border-dash-border bg-dash-muted/20 flex flex-col border-b lg:border-r lg:border-b-0">
            <div className="border-dash-border space-y-2 border-b px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-dash-foreground text-xs font-semibold tracking-wide uppercase">Select to review</p>
                <span className="text-dash-muted-foreground text-[11px] tabular-nums">{reviewFiles.length}</span>
              </div>
              <p className="text-dash-muted-foreground text-[11px]">PDF or Word from Project files</p>
              {reviewFiles.length > 4 ? (
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Find by name or group"
                  className={`${INPUT} rounded-none`}
                  aria-label="Find file"
                />
              ) : null}
            </div>

            <nav aria-label="Files to review" className="max-h-[28rem] overflow-y-auto lg:max-h-[min(70vh,42rem)]">
              {filteredFolders.length ? (
                <ul>
                  {filteredFolders.map(([folder, items]) => (
                    <li key={folder}>
                      <p className="text-dash-muted-foreground bg-dash-canvas/50 px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase">
                        {folder}
                      </p>
                      <ul className="divide-dash-border divide-y border-b border-dash-border">
                        {items.map((f) => {
                          const doc = f.document_id ? docs.find((d) => d.id === f.document_id) : null;
                          const active =
                            selectedFileId === f.id ||
                            (Boolean(selectedId) && f.document_id === selectedId);
                          return (
                            <li key={f.id}>
                              <button
                                type="button"
                                onClick={() => openFile(f)}
                                disabled={pending}
                                className={`w-full px-3 py-2.5 text-left transition ${
                                  active
                                    ? "bg-dash-accent/12 border-l-dash-accent border-l-2"
                                    : "hover:bg-dash-muted/60 border-l-2 border-l-transparent"
                                }`}
                              >
                                <p className="text-dash-foreground truncate text-sm font-semibold">{f.name}</p>
                                <p className="text-dash-muted-foreground mt-0.5 text-[11px]">
                                  {isWordSource(f) ? "Word" : "PDF"} · {formatBytes(f.size_bytes)}
                                  {doc?.shared_with_supervisor ? " · Shared" : ""}
                                  {doc ? ` · ${tone(DOCUMENT_STATUSES, doc.status).label}` : " · Not opened yet"}
                                </p>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-dash-muted-foreground px-3 py-6 text-center text-sm">No PDFs match.</p>
              )}
            </nav>
          </aside>

          <div className="min-w-0 bg-dash-card/30 p-3 sm:p-4">
            {selected ? (
              <>
                {rootPartials.length ? (
                  <div className="mb-3 flex flex-wrap gap-1">
                    <button
                      type="button"
                      className={`px-2.5 py-1 text-xs font-semibold ${
                        !selected.parent_id ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground"
                      }`}
                      onClick={() => rootId && setSelectedId(rootId)}
                    >
                      Full document
                    </button>
                    {rootPartials.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`px-2.5 py-1 text-xs font-semibold ${
                          selected.id === p.id ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground"
                        }`}
                        onClick={() => setSelectedId(p.id)}
                      >
                        Pages {p.page_from}-{p.page_to}
                      </button>
                    ))}
                  </div>
                ) : null}
                <ReviewDetail key={selected.id} doc={selected} bundle={bundle} />
              </>
            ) : (
              <div className="text-dash-muted-foreground py-10 text-center text-sm">
                {pending
                  ? "Opening for review… Word files are converted to PDF first."
                  : "Select a PDF or Word file on the left to start reviewing."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function displayName(doc: DocumentItem) {
  if (doc.name === "Report" || isLegacyEmptySectionName(doc.name)) return "Report";
  return doc.name;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${BOX} bg-dash-card/40 px-3 py-2.5`}>
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-dash-foreground text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ReviewDetail({ doc, bundle }: { doc: DocumentItem; bundle: WorkspaceBundle }) {
  const ctx = useWs();
  const { workspaceId, viewer, supervisorToken } = ctx;
  const { run, pending, status } = useRun();
  const versions = bundle.files.filter((f) => f.document_id === doc.id);
  const latestPdf = versions.find((f) => isPdfFileName(f.name, f.mime_type)) ?? null;
  const latest = latestPdf ?? versions[0] ?? null;
  const marks = bundle.reviewMarks.filter((m) => m.document_id === doc.id);
  const st = tone(DOCUMENT_STATUSES, doc.status);
  const isPdf = Boolean(latest && isPdfFileName(latest.name, latest.mime_type));
  const pdfHref = latest && isPdf ? fileUrl(ctx, latest.id, true) : null;

  const title =
    doc.parent_id && doc.page_from && doc.page_to
      ? `Pages ${doc.page_from} to ${doc.page_to}`
      : displayName(doc);

  const parentName = doc.parent_id
    ? displayName(bundle.documents.find((d) => d.id === doc.parent_id) ?? doc)
    : null;

  const topFileActions = (
    <div className="inline-flex flex-wrap items-center gap-0.5">
      {viewer.canEdit ? (
        <span className="[&_button]:h-7 [&_button]:rounded-none [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none [&_button]:hover:bg-dash-muted">
          <FileUploadButton folder="Reports" documentId={doc.id} label={latest ? "Replace" : "Upload"} soft />
        </span>
      ) : null}
      {latest ? (
        <a
          href={fileUrl(ctx, latest.id)}
          className="text-dash-muted-foreground hover:bg-dash-muted hover:text-dash-foreground inline-flex h-7 items-center px-2.5 text-xs font-semibold"
        >
          Download
        </a>
      ) : null}
      {viewer.canEdit ? (
        <button
          type="button"
          className={`inline-flex h-7 items-center rounded-none border-0 px-2.5 text-xs font-semibold ${
            doc.shared_with_supervisor
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
              : "bg-dash-accent text-white"
          }`}
          disabled={pending}
          onClick={() => run(() => setDocumentSharedAction(workspaceId, doc.id, !doc.shared_with_supervisor))}
        >
          {doc.shared_with_supervisor ? "Shared" : "Share"}
        </button>
      ) : doc.shared_with_supervisor ? (
        <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex h-7 items-center px-2.5 text-xs font-semibold">
          Shared with you
        </span>
      ) : null}
      {viewer.canEdit && latest ? (
        <button
          type="button"
          className="inline-flex h-7 items-center rounded-none border-0 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-300"
          disabled={pending}
          onClick={() =>
            window.confirm(`Delete "${latest.name}"? You can upload another PDF after.`) &&
            run(() => deleteFileAction(workspaceId, latest.id))
          }
        >
          Delete file
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="border-dash-border space-y-2.5 border-b pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {parentName ? (
              <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                Under {parentName}
              </p>
            ) : (
              <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Main document</p>
            )}
            <h3 className="text-dash-foreground mt-0.5 text-lg font-semibold tracking-tight">{title}</h3>
            <p className="text-dash-muted-foreground mt-0.5 truncate text-xs" title={latest?.name}>
              {latest ? `${latest.name} · ${formatBytes(latest.size_bytes)}` : "No PDF uploaded yet"}
            </p>
          </div>
          {viewer.canEdit ? (
            <select
              aria-label="Status"
              value={doc.status}
              onChange={(e) => run(() => saveItemAction(workspaceId, "document", doc.id, { name: doc.name, status: e.target.value }))}
              className={`rounded-none border-0 px-2.5 py-1 text-xs font-semibold ${st.tone}`}
            >
              {DOCUMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <Badge className={st.tone}>{st.label}</Badge>
          )}
        </div>
        {topFileActions}
      </div>

      {viewer.canEdit && versions.length > 1 ? (
        <div className={BOX_PAD}>
          <p className="text-dash-foreground mb-2 text-xs font-semibold tracking-wide uppercase">Versions</p>
          <ul className="text-dash-muted-foreground space-y-1.5 text-xs">
            {versions.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <span className={i === 0 ? "text-dash-foreground font-semibold" : ""}>
                  {i === 0 ? "Current: " : "Old: "}
                  {f.name} ({formatBytes(f.size_bytes)})
                </span>
                {i > 0 ? (
                  <button
                    type="button"
                    className={BTN_DANGER}
                    disabled={pending}
                    onClick={() =>
                      window.confirm(`Delete old file "${f.name}"?`) && run(() => deleteFileAction(workspaceId, f.id))
                    }
                  >
                    Delete
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pdfHref && isPdf ? (
        <ReviewPaper
          pdfUrl={pdfHref}
          marks={marks}
          disabled={pending}
          canSplit={viewer.canEdit && !doc.parent_id}
          onSplit={(from, to) => run(() => splitDocumentPartialAction(workspaceId, doc.id, from, to))}
          onAddComment={(input, onOk) =>
            run(
              () =>
                addReviewMarkAction(
                  workspaceId,
                  doc.id,
                  {
                    kind: "comment",
                    pageNumber: input.pageNumber,
                    pinX: input.pinX,
                    pinY: input.pinY,
                    body: input.body,
                  },
                  supervisorToken,
                ),
              { onOk: (data) => onOk?.(data) },
            )
          }
          onAddDraw={(input, onOk) =>
            run(
              () =>
                addReviewMarkAction(
                  workspaceId,
                  doc.id,
                  {
                    kind: input.kind ?? "draw",
                    pageNumber: input.pageNumber,
                    strokes: input.strokes,
                    body: input.body,
                    pinX: input.pinX,
                    pinY: input.pinY,
                  },
                  supervisorToken,
                ),
              { onOk: (data) => onOk?.(data) },
            )
          }
          onDeleteMark={(id) => run(() => deleteReviewMarkAction(workspaceId, id))}
          canDelete={(m) => viewer.canEdit || (viewer.kind === "supervisor" && m.author_kind === "supervisor")}
        />
      ) : latest ? (
        <p className="text-dash-muted-foreground text-sm">
          PDF works best so comments and drawings stay on the paper. Replace with a PDF version above.
        </p>
      ) : (
        <p className="text-dash-muted-foreground text-sm">Upload a PDF above to start reviewing on the paper.</p>
      )}

      {viewer.canEdit ? (
        <Label text="What I changed since last feedback">
          <textarea
            defaultValue={doc.change_summary ?? ""}
            rows={3}
            maxLength={4000}
            onBlur={(e) =>
              e.target.value !== (doc.change_summary ?? "") &&
              run(() => saveItemAction(workspaceId, "document", doc.id, { change_summary: e.target.value }, { quiet: true }))
            }
            placeholder="Short list for the supervisor summary printout"
            className={`${INPUT} rounded-none`}
          />
        </Label>
      ) : doc.change_summary ? (
        <div className={BOX_PAD}>
          <p className="text-dash-muted-foreground text-xs font-semibold uppercase">What the student changed</p>
          <p className="text-dash-foreground mt-1 whitespace-pre-wrap text-sm">{doc.change_summary}</p>
        </div>
      ) : null}

      <div>
        <p className="text-dash-muted-foreground mb-2 text-xs font-semibold uppercase">Notes on paper</p>
        <MarksList marks={marks.filter((m) => m.kind !== "general")} />
        <Status status={status} />
      </div>

      <div>
        <p className="text-dash-muted-foreground text-xs font-semibold uppercase">Thread</p>
        <CommentsThread targetType="document" targetId={doc.id} comments={bundle.comments} />
      </div>

      {viewer.canEdit ? (
        <div className="text-right">
          <button
            type="button"
            className={BTN_DANGER}
            onClick={() =>
              window.confirm(`Delete "${doc.name}"? Files stay in Files.`) &&
              run(() => deleteItemAction(workspaceId, "document", doc.id))
            }
          >
            Delete document
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MarksList({ marks }: { marks: ReviewMark[] }) {
  const { workspaceId, viewer } = useWs();
  const { run } = useRun();
  if (!marks.length) {
    return <p className="text-dash-muted-foreground text-sm">No page notes or drawings yet.</p>;
  }
  return (
    <ul className={`${BOX} divide-dash-border divide-y overflow-hidden`}>
      {[...marks].reverse().map((m) => (
        <li key={m.id} className="bg-dash-muted/30 px-3 py-2.5 text-sm">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <span className="text-dash-foreground font-semibold">{m.author_name}</span>
            <Badge className="bg-dash-muted text-dash-muted-foreground rounded-none">
              {m.kind === "general"
                ? "General"
                : m.kind === "highlight"
                  ? `Highlight · p.${m.page_number}`
                  : m.kind === "draw"
                    ? `On paper · p.${m.page_number}`
                    : m.pin_x != null
                      ? `Pinned on p.${m.page_number}`
                      : `Page ${m.page_number}`}
            </Badge>
            <span className="text-dash-muted-foreground text-xs">{formatDateTime(m.created_at)}</span>
            {viewer.canEdit || (viewer.kind === "supervisor" && m.author_kind === "supervisor") ? (
              <button type="button" className={`${BTN_DANGER} ml-auto`} onClick={() => run(() => deleteReviewMarkAction(workspaceId, m.id))}>
                Delete
              </button>
            ) : null}
          </div>
          {m.body ? <p className="text-dash-foreground whitespace-pre-wrap">{m.body}</p> : null}
          {m.kind === "draw" && m.strokes.length ? <StrokePreview strokes={m.strokes} /> : null}
        </li>
      ))}
    </ul>
  );
}

function StrokePreview({ strokes }: { strokes: ReviewMark["strokes"] }) {
  const w = 220;
  const h = 120;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="border-dash-border mt-2 max-w-full rounded-none border bg-white" width={w} height={h}>
      {strokes.map((s, i) => (
        <polyline
          key={i}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={s.points.map((p) => `${p.x * w},${p.y * h}`).join(" ")}
        />
      ))}
    </svg>
  );
}
