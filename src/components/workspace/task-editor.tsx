"use client";

import { useState } from "react";

import { deleteItemAction, saveItemAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_DANGER, BTN_GHOST, BTN_SOFT, INPUT, Label, Modal, Status } from "@/components/workspace/ws-ui";
import { PHASE_COLORS, phaseColor, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/workspace/constants";
import { addDays, todayIso } from "@/lib/workspace/dates";
import type { ChecklistItem, Phase, Task } from "@/lib/workspace/types";

export type TaskDraft = Partial<Task> & { id?: string };

export function TaskEditor({
  open,
  onClose,
  task,
  tasks,
  phases,
}: {
  open: boolean;
  onClose: () => void;
  task: TaskDraft | null;
  tasks: Task[];
  phases: Phase[];
}) {
  if (!open || !task) return null;
  return <TaskEditorInner key={task.id ?? "new"} onClose={onClose} task={task} tasks={tasks} phases={phases} />;
}

function TaskEditorInner({ onClose, task, tasks, phases }: { onClose: () => void; task: TaskDraft; tasks: Task[]; phases: Phase[] }) {
  const { workspaceId, viewer, members } = useWs();
  const { run, pending, status } = useRun();
  const today = todayIso();
  const [title, setTitle] = useState(task.title ?? "");
  const [phaseId, setPhaseId] = useState(task.phase_id ?? phases[0]?.id ?? "");
  const [st, setSt] = useState(task.status ?? "todo");
  const [priority, setPriority] = useState(task.priority ?? "normal");
  const [assignee, setAssignee] = useState(task.assignee_id ?? "");
  const [start, setStart] = useState(task.start_date ?? today);
  const [due, setDue] = useState(task.due_date ?? addDays(today, 6));
  const [progress, setProgress] = useState(task.progress ?? 0);
  const [milestone, setMilestone] = useState(Boolean(task.is_milestone));
  const [deps, setDeps] = useState<string[]>(task.depends_on ?? []);
  const [description, setDescription] = useState(task.description ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist ?? []);
  const [newItem, setNewItem] = useState("");
  const ro = !viewer.canEdit;
  const others = tasks.filter((t) => t.id !== task.id);

  function save() {
    run(
      () =>
        saveItemAction(workspaceId, "task", task.id ?? null, {
          title,
          phase_id: phaseId || null,
          status: st,
          priority,
          assignee_id: assignee || null,
          start_date: start || null,
          due_date: milestone ? start || due : due || null,
          progress: st === "done" ? 100 : progress,
          is_milestone: milestone,
          depends_on: deps,
          description,
          checklist,
          ...(task.id ? {} : { sort_order: tasks.length }),
        }),
      { onOk: onClose },
    );
  }

  return (
    <Modal open onClose={onClose} title={task.id ? "Edit task" : "New task"} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label text="Task" wide>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={INPUT} disabled={ro} autoFocus />
        </Label>
        <Label text="Phase">
          <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} className={INPUT} disabled={ro}>
            <option value="">No phase</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Who does it">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={INPUT} disabled={ro}>
            <option value="">Not assigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Status">
          <select value={st} onChange={(e) => setSt(e.target.value as Task["status"])} className={INPUT} disabled={ro}>
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])} className={INPUT} disabled={ro}>
            {TASK_PRIORITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Label>
        <Label text={milestone ? "Date" : "Start"}>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} disabled={ro} />
        </Label>
        {!milestone ? (
          <Label text="Due">
            <input type="date" value={due} min={start} onChange={(e) => setDue(e.target.value)} className={INPUT} disabled={ro} />
          </Label>
        ) : (
          <div />
        )}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={milestone} onChange={(e) => setMilestone(e.target.checked)} disabled={ro} />
          Milestone (a single important date, such as a presentation or submission)
        </label>
        {!milestone && st !== "done" ? (
          <Label text={`Progress: ${progress}%`} wide>
            <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full" disabled={ro} />
          </Label>
        ) : null}
        <Label text="Notes" wide>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000} className={INPUT} disabled={ro} />
        </Label>
      </div>

      <div className="mt-4">
        <p className="text-dash-muted-foreground mb-1 text-xs font-semibold uppercase">
          Checklist {checklist.length ? `(${checklist.filter((c) => c.done).length}/${checklist.length})` : ""}
        </p>
        <ul className="space-y-1">
          {checklist.map((c, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={c.done}
                disabled={ro}
                onChange={() => setChecklist(checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
              />
              <span className={c.done ? "text-dash-muted-foreground line-through" : "text-dash-foreground"}>{c.text}</span>
              {!ro ? (
                <button type="button" className={BTN_GHOST} onClick={() => setChecklist(checklist.filter((_, j) => j !== i))} aria-label="Remove item">
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {!ro ? (
          <div className="mt-1.5 flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItem.trim()) {
                  e.preventDefault();
                  setChecklist([...checklist, { text: newItem.trim(), done: false }]);
                  setNewItem("");
                }
              }}
              placeholder="Add a checklist item and press Enter"
              className={INPUT}
            />
          </div>
        ) : null}
      </div>

      {others.length ? (
        <details className="mt-4" open={deps.length > 0}>
          <summary className="text-dash-muted-foreground cursor-pointer text-xs font-semibold uppercase">
            Depends on ({deps.length}) – this task starts after them
          </summary>
          <div className="border-dash-border mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border p-2">
            {others.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={ro}
                  checked={deps.includes(t.id)}
                  onChange={(e) => setDeps(e.target.checked ? [...deps, t.id] : deps.filter((d) => d !== t.id))}
                />
                <span className="truncate">{t.title}</span>
              </label>
            ))}
          </div>
        </details>
      ) : null}

      {!ro ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending || !title.trim()} onClick={save} className={BTN}>
            {pending ? "Saving…" : "Save task"}
          </button>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Cancel
          </button>
          {task.id ? (
            <button
              type="button"
              className={`${BTN_DANGER} ml-auto`}
              disabled={pending}
              onClick={() => window.confirm("Delete this task?") && run(() => deleteItemAction(workspaceId, "task", task.id!), { onOk: onClose })}
            >
              Delete task
            </button>
          ) : null}
          <div className="w-full">
            <Status status={status} />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function PhaseManager({ phases }: { phases: Phase[] }) {
  const { workspaceId, viewer } = useWs();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { run, pending, status } = useRun();
  if (!viewer.canEdit) return null;
  return (
    <>
      <button type="button" className={BTN_SOFT} onClick={() => setOpen(true)}>
        Phases
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Phases">
        <p className="text-dash-muted-foreground mb-3 text-sm">Phases group tasks on the Gantt chart. Deleting a phase keeps its tasks.</p>
        <ul className="space-y-2">
          {phases.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2">
              <select
                aria-label="Colour"
                defaultValue={p.color}
                onChange={(e) => run(() => saveItemAction(workspaceId, "phase", p.id, { color: e.target.value }, { quiet: true }))}
                className={`${INPUT} w-28`}
              >
                {PHASE_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className={`h-3 w-3 shrink-0 rounded-full ${phaseColor(p.color).bar}`} />
              <input
                defaultValue={p.name}
                maxLength={80}
                onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && run(() => saveItemAction(workspaceId, "phase", p.id, { name: e.target.value }))}
                className={INPUT}
              />
              <button type="button" className={BTN_GHOST} disabled={i === 0 || pending} aria-label="Move up"
                onClick={() => {
                  const prev = phases[i - 1];
                  run(async () => {
                    await saveItemAction(workspaceId, "phase", p.id, { sort_order: prev.sort_order }, { quiet: true });
                    return saveItemAction(workspaceId, "phase", prev.id, { sort_order: p.sort_order === prev.sort_order ? p.sort_order + 1 : p.sort_order }, { quiet: true });
                  });
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className={BTN_DANGER}
                onClick={() => window.confirm(`Delete phase "${p.name}"?`) && run(() => deleteItemAction(workspaceId, "phase", p.id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveItemAction(workspaceId, "phase", null, {
                  name,
                  color: PHASE_COLORS[phases.length % PHASE_COLORS.length],
                  sort_order: phases.length ? Math.max(...phases.map((p) => p.sort_order)) + 1 : 0,
                }),
              { onOk: () => setName("") },
            );
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New phase name" className={INPUT} required maxLength={80} />
          <button type="submit" disabled={pending} className={BTN}>
            Add
          </button>
        </form>
        <div className="mt-2">
          <Status status={status} />
        </div>
      </Modal>
    </>
  );
}
