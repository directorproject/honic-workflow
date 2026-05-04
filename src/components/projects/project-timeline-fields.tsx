"use client";

import { useMemo, useState } from "react";

type MilestoneDraft = { title: string; target_date: string; assignee: string };

function emptyRow(): MilestoneDraft {
  return { title: "", target_date: "", assignee: "" };
}

/** Client-only: dates, milestone rows, hidden JSON. Static intro lives in `project-timeline-card.tsx` (server). */
export function ProjectTimelineFields() {
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([emptyRow()]);

  const timelineJson = useMemo(() => {
    const cleaned = milestones
      .map((m) => ({
        title: m.title.trim(),
        target_date: m.target_date.trim() || null,
        assignee: m.assignee.trim() || null,
      }))
      .filter((m) => m.title.length > 0);
    return JSON.stringify(cleaned);
  }, [milestones]);

  function addRow() {
    setMilestones((rows) => [...rows, emptyRow()]);
  }

  function removeRow(index: number) {
    setMilestones((rows) => (rows.length <= 1 ? [emptyRow()] : rows.filter((_, i) => i !== index)));
  }

  function patchRow(index: number, patch: Partial<MilestoneDraft>) {
    setMilestones((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="start_date" className="text-dash-muted-foreground mb-1 block text-xs font-medium">
            Start date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="target_end_date" className="text-dash-muted-foreground mb-1 block text-xs font-medium">
            Target end
          </label>
          <input
            id="target_end_date"
            name="target_end_date"
            type="date"
            className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
          />
        </div>
      </div>

      <p className="text-dash-muted-foreground mb-2 text-xs font-medium">Milestones</p>
      <div className="space-y-4">
        {milestones.map((row, index) => (
          <div key={index} className="border-dash-border/80 space-y-2 rounded-xl border border-dashed p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="text-dash-muted-foreground mb-1 block text-[11px] font-medium" htmlFor={`milestone-title-${index}`}>
                  Activity / milestone
                </label>
                <input
                  id={`milestone-title-${index}`}
                  type="text"
                  value={row.title}
                  onChange={(e) => patchRow(index, { title: e.target.value })}
                  placeholder="e.g. Schematic review"
                  autoComplete="off"
                  className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                />
              </div>
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-44">
                <label className="text-dash-muted-foreground mb-1 block text-[11px] font-medium" htmlFor={`milestone-date-${index}`}>
                  Target date
                </label>
                <div className="flex gap-2">
                  <input
                    id={`milestone-date-${index}`}
                    type="date"
                    value={row.target_date}
                    onChange={(e) => patchRow(index, { target_date: e.target.value })}
                    className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 min-w-0 flex-1 rounded-xl border px-2 py-2.5 text-sm outline-none focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-dash-muted-foreground hover:text-dash-foreground hover:bg-dash-border/40 shrink-0 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors"
                    aria-label="Remove milestone row"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-dash-muted-foreground mb-1 block text-[11px] font-medium" htmlFor={`milestone-assignee-${index}`}>
                Assigned to <span className="font-normal opacity-80">(name)</span>
              </label>
              <input
                id={`milestone-assignee-${index}`}
                type="text"
                value={row.assignee}
                onChange={(e) => patchRow(index, { assignee: e.target.value })}
                placeholder="Who owns this milestone"
                autoComplete="name"
                className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-dash-muted-foreground mt-2 text-xs leading-relaxed">
        For each activity, set who is responsible and an optional target date (e.g. layout release — 2026-06-15).
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="text-dash-accent hover:text-dash-foreground text-sm font-semibold underline-offset-2 hover:underline"
        >
          Add milestone
        </button>
      </div>

      <input type="hidden" name="timeline_milestones" value={timelineJson} readOnly />
    </>
  );
}
