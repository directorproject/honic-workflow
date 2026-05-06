"use client";

import { useActionState, useMemo, useState } from "react";

import type { ShareResearchLink } from "@/lib/share-client-references";
import { updateProjectShareReferences } from "@/app/projects/[id]/share-references-actions";

type Row = ShareResearchLink;

function emptyRows(count: number): Row[] {
  return Array.from({ length: count }, () => ({ label: "", url: "" }));
}

export function ProjectShareReferencesForm({
  projectId,
  initialNotes,
  initialLinks,
}: {
  projectId: string;
  initialNotes: string | null;
  initialLinks: ShareResearchLink[];
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    const base = initialLinks.length > 0 ? [...initialLinks] : emptyRows(3);
    if (base.length < 3) return [...base, ...emptyRows(3 - base.length)];
    return base;
  });

  const bound = updateProjectShareReferences.bind(null, projectId);
  const [state, action, pending] = useActionState(bound, null as { ok: boolean; message?: string } | null);

  const linksJson = useMemo(() => JSON.stringify(rows.filter((r) => r.label.trim() && r.url.trim())), [rows]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { label: "", url: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  return (
    <section
      className="border-dash-border bg-dash-card mb-10 scroll-mt-28 rounded-2xl border p-5 shadow-sm sm:p-6"
      aria-labelledby="share-refs-heading"
    >
      <h2 id="share-refs-heading" className="text-dash-foreground mb-1 text-lg font-semibold">
        References for share link
      </h2>
      <p className="text-dash-muted-foreground mb-5 max-w-3xl text-sm leading-relaxed">
        Documents and URLs you add here appear on the public share page below pipeline files. Share the strongest
        material from internal source-find so clients can improve their own documentation and references.
      </p>

      <form action={action} className="space-y-5">
        <input type="hidden" name="share_research_links_json" value={linksJson} readOnly />

        <div>
          <label htmlFor="share_research_notes" className="text-dash-foreground mb-1 block text-sm font-medium">
            Notes / document summary
          </label>
          <textarea
            id="share_research_notes"
            name="share_research_notes"
            rows={6}
            defaultValue={initialNotes ?? ""}
            disabled={pending}
            placeholder="e.g. key datasheets, standards, or short context on what each link is for..."
            className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full max-w-3xl rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
          />
        </div>

        <div>
          <p className="text-dash-foreground mb-2 text-sm font-medium">Links</p>
          <ul className="max-w-3xl space-y-3">
            {rows.map((row, i) => (
              <li key={i} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="Label"
                  disabled={pending}
                  className="border-dash-border bg-dash-muted/30 text-dash-foreground sm:w-[min(40%,220px)] w-full shrink-0 rounded-lg border px-2.5 py-2 text-sm"
                />
                <input
                  type="url"
                  value={row.url}
                  onChange={(e) => updateRow(i, { url: e.target.value })}
                  placeholder="https://…"
                  disabled={pending}
                  className="border-dash-border bg-dash-muted/30 text-dash-foreground min-w-0 flex-1 rounded-lg border px-2.5 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={pending || rows.length <= 1}
                  onClick={() => removeRow(i)}
                  className="text-dash-muted-foreground hover:text-red-600 dark:hover:text-red-400 shrink-0 rounded-lg px-2 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addRow}
            disabled={pending}
            className="text-dash-accent hover:text-dash-accent-dim mt-3 text-sm font-semibold underline-offset-2 hover:underline"
          >
            + Add link row
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-dash-accent hover:bg-dash-accent-dim rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save for share link"}
          </button>
          {state?.message ? (
            <span className={`text-sm font-medium ${state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {state.message}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
