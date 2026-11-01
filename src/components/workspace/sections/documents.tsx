"use client";

import { useState } from "react";

import { deleteItemAction, saveItemAction } from "@/app/portal/workspace-actions";
import { CommentsThread } from "@/components/workspace/comments";
import { FileUploadButton } from "@/components/workspace/file-upload";
import { fileUrl, useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN, BTN_DANGER, BTN_GHOST, INPUT, Label, Panel, Status } from "@/components/workspace/ws-ui";
import { DOCUMENT_STATUSES, formatBytes, tone } from "@/lib/workspace/constants";
import { formatDate, formatDateTime, relativeDays } from "@/lib/workspace/dates";
import type { DocumentItem, WorkspaceBundle } from "@/lib/workspace/types";

export const TEMPLATES = [
  { file: "honic-project-proposal-template.docx", name: "Project proposal", note: "Title page, problem, objectives, method, budget and work plan." },
  { file: "honic-final-report-template.docx", name: "Final report", note: "Chapters 1 to 5 with headings, figures, tables and references." },
  { file: "honic-logbook-template.docx", name: "Logbook (paper copy)", note: "Weekly entries with supervisor signature lines." },
  { file: "honic-presentation-outline.docx", name: "Presentation outline", note: "Slide-by-slide plan for the proposal and final defence." },
];

export function DocumentsSection({ bundle, today }: { bundle: WorkspaceBundle; today: string }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const [name, setName] = useState("");
  const approved = bundle.documents.filter((d) => d.status === "approved").length;

  return (
    <>
      <Panel
        title="Report chapters and documents"
        subtitle={`${approved} of ${bundle.documents.length} approved.${viewer.canEdit ? " Upload each new version; earlier versions stay here." : ""}`}
      >
        <ul className="space-y-3">
          {bundle.documents.map((d) => (
            <DocumentRow key={d.id} doc={d} bundle={bundle} today={today} />
          ))}
        </ul>
        {viewer.canEdit ? (
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveItemAction(workspaceId, "document", null, { name, status: "not_started", sort_order: bundle.documents.length }), {
                onOk: () => setName(""),
              });
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} placeholder="Add a document, e.g. Ethics form" className={`${INPUT} max-w-md flex-1`} />
            <button type="submit" disabled={pending} className={BTN}>
              Add document
            </button>
            <Status status={status} />
          </form>
        ) : null}
      </Panel>

      {viewer.kind !== "supervisor" ? (
        <Panel title="Templates" subtitle="Word templates in Honic format. Check your institution's guidelines too.">
          <div className="grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <a key={t.file} href={`/templates/${t.file}`} download className="border-dash-border hover:border-dash-accent/50 hover:bg-dash-muted/40 rounded-xl border p-3">
                <p className="text-dash-foreground text-sm font-semibold">{t.name} ↓</p>
                <p className="text-dash-muted-foreground text-xs">{t.note}</p>
              </a>
            ))}
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function DocumentRow({ doc, bundle, today }: { doc: DocumentItem; bundle: WorkspaceBundle; today: string }) {
  const ctx = useWs();
  const { workspaceId, viewer } = ctx;
  const { run, status } = useRun();
  const [open, setOpen] = useState(false);
  const versions = bundle.files.filter((f) => f.document_id === doc.id);
  const comments = bundle.comments.filter((c) => c.target_type === "document" && c.target_id === doc.id);
  const st = tone(DOCUMENT_STATUSES, doc.status);
  const late = doc.due_date && doc.due_date < today && doc.status !== "approved";

  return (
    <li className="border-dash-border rounded-xl border">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <p className="text-dash-foreground text-sm font-semibold">{doc.name}</p>
          <p className={`text-xs ${late ? "font-semibold text-rose-600 dark:text-rose-300" : "text-dash-muted-foreground"}`}>
            {versions.length ? `${versions.length} version${versions.length === 1 ? "" : "s"}` : "No file yet"}
            {doc.due_date ? ` · due ${formatDate(doc.due_date, { year: undefined })} (${relativeDays(doc.due_date, today)})` : ""}
            {comments.length ? ` · ${comments.length} comment${comments.length === 1 ? "" : "s"}` : ""}
          </p>
        </button>
        {viewer.canEdit ? (
          <select
            aria-label="Status"
            value={doc.status}
            onChange={(e) => run(() => saveItemAction(workspaceId, "document", doc.id, { name: doc.name, status: e.target.value }))}
            className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${st.tone}`}
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
        <button type="button" className={BTN_GHOST} onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Close" : "Open"}
        </button>
      </div>
      {open ? (
        <div className="border-dash-border border-t px-3 py-3">
          {viewer.canEdit ? (
            <div className="mb-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
              <Label text="Due date">
                <input
                  type="date"
                  defaultValue={doc.due_date ?? ""}
                  onChange={(e) => run(() => saveItemAction(workspaceId, "document", doc.id, { due_date: e.target.value }, { quiet: true }))}
                  className={INPUT}
                />
              </Label>
              <Label text="Notes">
                <input
                  defaultValue={doc.notes ?? ""}
                  maxLength={2000}
                  onBlur={(e) => e.target.value !== (doc.notes ?? "") && run(() => saveItemAction(workspaceId, "document", doc.id, { notes: e.target.value }, { quiet: true }))}
                  placeholder="e.g. Use IEEE referencing, max 15 pages"
                  className={INPUT}
                />
              </Label>
            </div>
          ) : doc.notes ? (
            <p className="text-dash-muted-foreground mb-3 text-sm">{doc.notes}</p>
          ) : null}

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-dash-muted-foreground text-xs font-semibold uppercase">Versions</p>
            <FileUploadButton folder="Reports" documentId={doc.id} label="Upload new version" soft />
          </div>
          {versions.length ? (
            <ul className="space-y-1">
              {versions.map((f, i) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className={i === 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-dash-muted text-dash-muted-foreground"}>
                    v{versions.length - i}
                    {i === 0 ? " latest" : ""}
                  </Badge>
                  <a href={fileUrl(ctx, f.id)} className="text-dash-accent truncate font-medium hover:underline">
                    {f.name}
                  </a>
                  <span className="text-dash-muted-foreground text-xs">
                    {formatBytes(f.size_bytes)} · {f.uploaded_by_name ?? ""} · {formatDateTime(f.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-dash-muted-foreground text-sm">{viewer.canEdit ? "Upload the first draft when it is ready." : "No file yet."}</p>
          )}

          <p className="text-dash-muted-foreground mt-4 text-xs font-semibold uppercase">Feedback</p>
          <CommentsThread targetType="document" targetId={doc.id} comments={bundle.comments} />

          {viewer.canEdit ? (
            <div className="mt-3 text-right">
              <button
                type="button"
                className={BTN_DANGER}
                onClick={() => window.confirm(`Delete "${doc.name}"? Its files stay in Files.`) && run(() => deleteItemAction(workspaceId, "document", doc.id))}
              >
                Delete document
              </button>
            </div>
          ) : null}
          <Status status={status} />
        </div>
      ) : null}
    </li>
  );
}
