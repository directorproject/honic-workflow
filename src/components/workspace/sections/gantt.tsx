"use client";

import { useState } from "react";

import { AppendixGanttTable } from "@/components/workspace/appendix-gantt";
import { GanttChart, type Zoom } from "@/components/workspace/gantt-chart";
import { RescheduleButton, TemplateButton } from "@/components/workspace/plan-tools";
import { PhaseManager, TaskEditor, type TaskDraft } from "@/components/workspace/task-editor";
import { useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_SOFT, Empty, Panel } from "@/components/workspace/ws-ui";
import type { WorkspaceBundle } from "@/lib/workspace/types";

const ZOOMS: { value: Zoom; label: string }[] = [
  { value: "day", label: "Days" },
  { value: "week", label: "Weeks" },
  { value: "month", label: "Months" },
];

export function GanttSection({
  bundle,
  today,
  printHref,
}: {
  bundle: WorkspaceBundle;
  today: string;
  printHref: string;
}) {
  const { viewer } = useWs();
  const [zoom, setZoom] = useState<Zoom>("week");
  const [editing, setEditing] = useState<TaskDraft | null>(null);
  const ws = bundle.workspace;

  return (
    <div className="space-y-4">
      <Panel
        title="Gantt chart"
        subtitle="Your whole plan on a timeline, grouped by phase."
        actions={
          <>
            <div className="border-dash-border flex overflow-hidden rounded-xl border" role="group" aria-label="Zoom">
              {ZOOMS.map((z) => (
                <button
                  key={z.value}
                  type="button"
                  onClick={() => setZoom(z.value)}
                  className={`px-3 py-1.5 text-xs font-semibold ${zoom === z.value ? "bg-dash-accent text-white" : "text-dash-muted-foreground hover:bg-dash-muted"}`}
                >
                  {z.label}
                </button>
              ))}
            </div>
            <PhaseManager phases={bundle.phases} />
            <TemplateButton hasTasks={bundle.tasks.length > 0} category={ws.project_category} start={ws.start_date} end={ws.end_date} />
            {bundle.tasks.length ? (
              <RescheduleButton
                tasks={bundle.tasks}
                className="border-dash-border bg-dash-card hover:bg-dash-muted inline-flex rounded-xl border px-3.5 py-2 text-sm font-semibold"
                label="Catch up"
              />
            ) : null}
            {viewer.canEdit ? (
              <button type="button" className={BTN} onClick={() => setEditing({ phase_id: bundle.phases[0]?.id ?? null })}>
                Add task
              </button>
            ) : null}
            <a href={printHref} target="_blank" rel="noreferrer" className={BTN_SOFT}>
              Export appendix
            </a>
          </>
        }
      >
        {bundle.tasks.length ? (
          <GanttChart workspace={ws} phases={bundle.phases} tasks={bundle.tasks} zoom={zoom} today={today} onOpenTask={(t) => setEditing(t)} />
        ) : (
          <Empty title="No tasks yet">Add a ready-made plan for your project type, or add tasks one by one.</Empty>
        )}
        <TaskEditor open={Boolean(editing)} onClose={() => setEditing(null)} task={editing} tasks={bundle.tasks} phases={bundle.phases} />
      </Panel>

      <Panel
        title="Appendix export preview"
        subtitle="Printable monthly coloured table for your report appendix."
        actions={
          <a href={printHref} target="_blank" rel="noreferrer" className={BTN_SOFT}>
            Open &amp; print PDF
          </a>
        }
      >
        <div className="overflow-x-auto rounded-none bg-white p-3 text-black">
          <AppendixGanttTable
            workspace={ws}
            phases={bundle.phases}
            tasks={bundle.tasks}
            appendixLabel="Appendix: B Gantt Chart"
          />
        </div>
      </Panel>
    </div>
  );
}
