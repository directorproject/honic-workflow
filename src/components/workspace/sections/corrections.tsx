"use client";

import Link from "next/link";
import { useState } from "react";

import { saveItemAction } from "@/app/portal/workspace-actions";
import { CommentsThread } from "@/components/workspace/comments";
import { FileUploadButton } from "@/components/workspace/file-upload";
import { fileUrl, useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN, BTN_GHOST, INPUT, Label, Panel, Status } from "@/components/workspace/ws-ui";
import { CORRECTION_STATUSES, formatBytes, tone } from "@/lib/workspace/constants";
import { formatDateTime } from "@/lib/workspace/dates";
import type { DocumentItem, WorkspaceBundle } from "@/lib/workspace/types";

/**
 * Digital correction loop: upload → feedback → track partial notes → print only the change summary.
 * Stops students reprinting the full document after every half-comment from a supervisor.
 */
export function CorrectionsSection({ bundle, printHref }: { bundle: WorkspaceBundle; printHref: string }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const [name, setName] = useState("");

  const docs = bundle.documents.filter((d) => d.status !== "not_started" || bundle.files.some((f) => f.document_id === d.id));
  const waiting = bundle.documents.filter((d) => d.status === "submitted").length;
  const partial = bundle.documents.filter((d) => d.status === "changes").length;

  return (
    <>
      <Panel
        title="Corrections"
        subtitle="Fix chapters online. Get feedback here. Print only what changed for your supervisor, not the whole report every time."
        actions={
          <Link href={printHref} target="_blank" className={`${BTN_GHOST} border-dash-border border px-3 py-1.5`}>
            Print supervisor summary
          </Link>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Waiting for feedback" value={waiting} />
          <Stat label="Partial, still open" value={partial} />
          <Stat label="Chapters in loop" value={docs.length || bundle.documents.length} />
        </div>
        <ol className="text-dash-muted-foreground mb-5 list-decimal space-y-1 pl-5 text-sm">
          <li>Upload or open a chapter.</li>
          <li>Supervisor leaves comments here (no print needed yet).</li>
          <li>Update status to Partial while notes are incomplete.</li>
          <li>Write a short “what I changed” list, then print only that summary for the meeting.</li>
        </ol>

        <ul className="space-y-3">
          {(docs.length ? docs : bundle.documents).map((d) => (
            <CorrectionRow key={d.id} doc={d} bundle={bundle} />
          ))}
        </ul>

        {viewer.canEdit ? (
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  saveItemAction(workspaceId, "document", null, {
                    name,
                    status: "draft",
                    sort_order: bundle.documents.length,
                  }),
                { onOk: () => setName("") },
              );
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
              placeholder="Add a chapter, e.g. Chapter 3 Methodology"
              className={`${INPUT} max-w-md flex-1`}
            />
            <button type="submit" disabled={pending || !name.trim()} className={BTN}>
              Add chapter
            </button>
            <Status status={status} />
          </form>
        ) : null}
      </Panel>

      <Panel title="Why this exists" subtitle="Many students reprint after every partial supervisor note and then stop going to the office.">
        <p className="text-dash-muted-foreground text-sm leading-relaxed">
          Use this tab so feedback stays digital. When you must meet your supervisor, take the{" "}
          <Link href={printHref} target="_blank" className="text-dash-accent font-semibold">
            supervisor summary
          </Link>{" "}
          (the change list and open comments) instead of a fresh full print each time.
        </p>
      </Panel>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-dash-border bg-dash-muted/30 rounded-xl border px-3 py-2">
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{label}</p>
      <p className="text-dash-foreground mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CorrectionRow({ doc, bundle }: { doc: DocumentItem; bundle: WorkspaceBundle }) {
  const ctx = useWs();
  const { workspaceId, viewer } = ctx;
  const { run, status } = useRun();
  const [open, setOpen] = useState(doc.status === "changes" || doc.status === "submitted");
  const versions = bundle.files.filter((f) => f.document_id === doc.id);
  const comments = bundle.comments.filter((c) => c.target_type === "document" && c.target_id === doc.id);
  const st = tone(CORRECTION_STATUSES, doc.status === "not_started" ? "draft" : doc.status);
  const summary = doc.change_summary ?? "";

  return (
    <li className="border-dash-border rounded-xl border">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <p className="text-dash-foreground text-sm font-semibold">{doc.name}</p>
          <p className="text-dash-muted-foreground text-xs">
            {versions.length ? `${versions.length} version${versions.length === 1 ? "" : "s"}` : "No file yet"}
            {comments.length ? ` · ${comments.length} comment${comments.length === 1 ? "" : "s"}` : ""}
            {summary.trim() ? " · change list ready" : ""}
          </p>
        </button>
        {viewer.canEdit ? (
          <select
            aria-label="Correction status"
            value={doc.status === "not_started" ? "draft" : doc.status}
            onChange={(e) =>
              run(() =>
                saveItemAction(workspaceId, "document", doc.id, {
                  name: doc.name,
                  status: e.target.value,
                }),
              )
            }
            className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${st.tone}`}
          >
            {CORRECTION_STATUSES.map((s) => (
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
        <div className="border-dash-border space-y-4 border-t px-3 py-3">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
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
                    {formatBytes(f.size_bytes)} · {formatDateTime(f.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-dash-muted-foreground text-sm">Upload the draft you would have printed.</p>
          )}

          <Label text="What I changed since last feedback (for the supervisor summary)">
            <textarea
              key={`${doc.id}-${doc.updated_at}-summary`}
              defaultValue={summary}
              rows={3}
              maxLength={4000}
              placeholder={"e.g.\n- Fixed objectives to match problem statement\n- Added figure 3.2\n- Still need decision on sample size"}
              onBlur={(e) => {
                if (e.target.value !== summary) {
                  run(() =>
                    saveItemAction(
                      workspaceId,
                      "document",
                      doc.id,
                      { name: doc.name, change_summary: e.target.value },
                      { quiet: true },
                    ),
                  );
                }
              }}
              className={INPUT}
              disabled={!viewer.canEdit}
            />
          </Label>

          <div>
            <p className="text-dash-muted-foreground text-xs font-semibold uppercase">Feedback thread</p>
            <CommentsThread targetType="document" targetId={doc.id} comments={bundle.comments} />
          </div>
          <Status status={status} />
        </div>
      ) : null}
    </li>
  );
}
