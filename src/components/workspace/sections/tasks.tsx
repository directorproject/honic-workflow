"use client";

import { useMemo, useState } from "react";

import { saveItemAction } from "@/app/portal/workspace-actions";
import { PhaseManager, TaskEditor, type TaskDraft } from "@/components/workspace/task-editor";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN, INPUT, Panel, Status } from "@/components/workspace/ws-ui";
import { phaseColor, TASK_STATUSES } from "@/lib/workspace/constants";
import { formatDate, relativeDays } from "@/lib/workspace/dates";
import type { Task, WorkspaceBundle } from "@/lib/workspace/types";

export function TasksSection({ bundle, today }: { bundle: WorkspaceBundle; today: string }) {
  const { workspaceId, viewer, members } = useWs();
  const { run, status } = useRun();
  const [editing, setEditing] = useState<TaskDraft | null>(null);
  const [phase, setPhase] = useState("");
  const [who, setWho] = useState("");
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      bundle.tasks.filter(
        (t) =>
          (!phase || t.phase_id === phase) &&
          (!who || (who === "none" ? !t.assignee_id : t.assignee_id === who)) &&
          (!q || t.title.toLowerCase().includes(q.toLowerCase())),
      ),
    [bundle.tasks, phase, who, q],
  );

  function move(t: Task, statusValue: Task["status"]) {
    if (t.status === statusValue) return;
    run(() => saveItemAction(workspaceId, "task", t.id, { status: statusValue, ...(statusValue === "doing" && t.progress === 0 ? { progress: 10 } : {}) }));
  }

  return (
    <Panel
      title="Task board"
      subtitle={viewer.canEdit ? "Drag cards between columns, or use the status menu on a card." : undefined}
      actions={
        <>
          <PhaseManager phases={bundle.phases} />
          {viewer.canEdit ? (
            <button type="button" className={BTN} onClick={() => setEditing({ phase_id: phase || bundle.phases[0]?.id || null })}>
              Add task
            </button>
          ) : null}
        </>
      }
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" className={INPUT} />
        <select value={phase} onChange={(e) => setPhase(e.target.value)} className={INPUT} aria-label="Phase">
          <option value="">All phases</option>
          {bundle.phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={who} onChange={(e) => setWho(e.target.value)} className={INPUT} aria-label="Assigned to">
          <option value="">Everyone</option>
          <option value="none">Not assigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name}
            </option>
          ))}
        </select>
      </div>
      <Status status={status} />

      <div className="mt-2 grid gap-4 md:grid-cols-3">
        {TASK_STATUSES.map((col) => {
          const list = filtered
            .filter((t) => t.status === col.value)
            .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
          return (
            <div
              key={col.value}
              onDragOver={(e) => {
                if (!viewer.canEdit) return;
                e.preventDefault();
                setOver(col.value);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const t = bundle.tasks.find((x) => x.id === dragId);
                if (t) move(t, col.value);
              }}
              className={`bg-dash-muted/30 min-h-40 rounded-2xl p-3 transition-colors ${over === col.value ? "ring-dash-accent bg-dash-accent/5 ring-2" : ""}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-dash-foreground text-sm font-semibold">{col.label}</p>
                <span className="text-dash-muted-foreground text-xs tabular-nums">{list.length}</span>
              </div>
              <ul className="space-y-2">
                {list.map((t) => {
                  const p = bundle.phases.find((x) => x.id === t.phase_id);
                  const late = t.status !== "done" && t.due_date && t.due_date < today;
                  const assignee = members.find((m) => m.user_id === t.assignee_id);
                  const checks = t.checklist.length ? `${t.checklist.filter((c) => c.done).length}/${t.checklist.length}` : null;
                  return (
                    <li
                      key={t.id}
                      draggable={viewer.canEdit}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`border-dash-border bg-dash-card rounded-xl border p-3 shadow-sm ${viewer.canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === t.id ? "opacity-50" : ""}`}
                    >
                      <button type="button" onClick={() => setEditing(t)} className="block w-full text-left">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          {p ? <Badge className={`${phaseColor(p.color).soft} ${phaseColor(p.color).text}`}>{p.name}</Badge> : null}
                          {t.is_milestone ? <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300">Milestone</Badge> : null}
                          {t.priority === "high" ? <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300">High</Badge> : null}
                        </div>
                        <p className={`text-sm font-medium ${t.status === "done" ? "text-dash-muted-foreground line-through" : "text-dash-foreground"}`}>{t.title}</p>
                        <div className="text-dash-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {t.due_date ? (
                            <span className={late ? "font-semibold text-rose-600 dark:text-rose-300" : ""}>
                              {late ? "Late · " : ""}
                              {formatDate(t.due_date, { year: undefined })} ({relativeDays(t.due_date, today)})
                            </span>
                          ) : null}
                          {checks ? <span>☑ {checks}</span> : null}
                          {assignee ? <span>{assignee.full_name.split(" ")[0]}</span> : null}
                          {t.status === "doing" ? <span>{t.progress}%</span> : null}
                        </div>
                      </button>
                      {viewer.canEdit ? (
                        <select
                          aria-label="Status"
                          value={t.status}
                          onChange={(e) => move(t, e.target.value as Task["status"])}
                          className="border-dash-border bg-dash-muted/30 text-dash-muted-foreground mt-2 w-full rounded-lg border px-2 py-1 text-xs md:hidden"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <TaskEditor open={Boolean(editing)} onClose={() => setEditing(null)} task={editing} tasks={bundle.tasks} phases={bundle.phases} />
    </Panel>
  );
}
