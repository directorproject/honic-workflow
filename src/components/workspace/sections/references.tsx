"use client";

import { useState } from "react";

import { deleteItemAction, saveItemAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_DANGER, BTN_GHOST, BTN_SOFT, Empty, INPUT, Label, Modal, Panel, Status } from "@/components/workspace/ws-ui";
import { REFERENCE_KINDS } from "@/lib/workspace/constants";
import { formatApa, formatIeee } from "@/lib/workspace/references";
import type { Reference } from "@/lib/workspace/types";

export function ReferencesSection({ references }: { references: Reference[] }) {
  const { workspaceId, viewer } = useWs();
  const { run, status } = useRun();
  const [style, setStyle] = useState<"ieee" | "apa">("ieee");
  const [editing, setEditing] = useState<Partial<Reference> | null>(null);
  const [copied, setCopied] = useState(false);
  const sorted = style === "apa" ? [...references].sort((a, b) => (a.authors ?? a.title).localeCompare(b.authors ?? b.title)) : references;
  const lines = sorted.map((r, i) => (style === "ieee" ? formatIeee(r, i + 1) : formatApa(r)));

  return (
    <Panel
      title="References"
      subtitle="Save every source as you read it, then copy the list into your report."
      actions={
        <>
          <div className="border-dash-border flex overflow-hidden rounded-xl border">
            {(["ieee", "apa"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStyle(s)} className={`px-3 py-1.5 text-xs font-semibold ${style === s ? "bg-dash-accent text-white" : "text-dash-muted-foreground hover:bg-dash-muted"}`}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
          {references.length ? (
            <button
              type="button"
              className={BTN_SOFT}
              onClick={async () => {
                await navigator.clipboard.writeText(lines.join("\n"));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied" : "Copy all"}
            </button>
          ) : null}
          {viewer.canEdit ? (
            <button type="button" className={BTN} onClick={() => setEditing({ kind: "article" })}>
              Add reference
            </button>
          ) : null}
        </>
      }
    >
      <Status status={status} />
      {references.length ? (
        <ol className="space-y-2">
          {sorted.map((r, i) => (
            <li key={r.id} className="border-dash-border flex items-start gap-3 rounded-xl border px-3 py-2">
              <p className="text-dash-foreground min-w-0 flex-1 text-sm leading-relaxed">{lines[i]}</p>
              {viewer.canEdit ? (
                <span className="flex shrink-0 gap-1">
                  <button type="button" className={BTN_GHOST} onClick={() => setEditing(r)}>
                    Edit
                  </button>
                  <button type="button" className={BTN_DANGER} onClick={() => window.confirm("Delete this reference?") && run(() => deleteItemAction(workspaceId, "reference", r.id))}>
                    ✕
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="No references yet">Add papers, books, websites and datasheets. Authors: separate with a semicolon, e.g. Juma Ali; Neema Mushi.</Empty>
      )}
      <ReferenceEditor reference={editing} onClose={() => setEditing(null)} />
    </Panel>
  );
}

function ReferenceEditor({ reference, onClose }: { reference: Partial<Reference> | null; onClose: () => void }) {
  const { workspaceId } = useWs();
  const { run, pending, status } = useRun();
  const [kind, setKind] = useState(reference?.kind ?? "article");
  if (!reference) return null;
  const sourceLabel = kind === "book" ? "Publisher" : kind === "website" || kind === "datasheet" ? "Website or company" : kind === "thesis" ? "Institution" : "Journal or conference";
  return (
    <Modal open onClose={onClose} title={reference.id ? "Edit reference" : "Add reference"} wide>
      <form
        key={reference.id ?? "new"}
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => saveItemAction(workspaceId, "reference", reference.id ?? null, Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]))), { onOk: onClose });
        }}
      >
        <Label text="Type">
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Reference["kind"])} className={INPUT}>
            {REFERENCE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Year">
          <input name="year" maxLength={10} defaultValue={reference.year ?? ""} className={INPUT} />
        </Label>
        <Label text="Title" wide>
          <input name="title" required maxLength={400} defaultValue={reference.title ?? ""} className={INPUT} autoFocus />
        </Label>
        <Label text="Authors (separate with ;)" wide>
          <input name="authors" maxLength={400} defaultValue={reference.authors ?? ""} placeholder="Juma Ali Hassan; Neema Mushi" className={INPUT} />
        </Label>
        <Label text={sourceLabel}>
          <input name="source" maxLength={240} defaultValue={reference.source ?? ""} className={INPUT} />
        </Label>
        <Label text="Volume / issue">
          <input name="volume" maxLength={40} defaultValue={reference.volume ?? ""} className={INPUT} />
        </Label>
        <Label text="Pages">
          <input name="pages" maxLength={40} defaultValue={reference.pages ?? ""} className={INPUT} />
        </Label>
        <Label text="DOI">
          <input name="doi" maxLength={120} defaultValue={reference.doi ?? ""} className={INPUT} />
        </Label>
        <Label text="Link">
          <input name="url" maxLength={500} defaultValue={reference.url ?? ""} className={INPUT} />
        </Label>
        <Label text="Accessed on">
          <input name="accessed_on" type="date" defaultValue={reference.accessed_on ?? ""} className={INPUT} />
        </Label>
        <Label text="Notes" wide>
          <input name="notes" maxLength={1000} defaultValue={reference.notes ?? ""} placeholder="What you used it for" className={INPUT} />
        </Label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button type="submit" disabled={pending} className={BTN}>
            {pending ? "Saving…" : "Save"}
          </button>
          <Status status={status} />
        </div>
      </form>
    </Modal>
  );
}
