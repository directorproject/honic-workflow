"use client";

import { useMemo, useState } from "react";

import { applyRescheduleAction, applyTemplateAction, shiftAllTasksAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_SOFT, INPUT, Label, Modal, Status } from "@/components/workspace/ws-ui";
import { defaultEndDate, formatDate, todayIso } from "@/lib/workspace/dates";
import { suggestReschedule } from "@/lib/workspace/schedule";
import { PLAN_TEMPLATES } from "@/lib/workspace/templates";
import type { Task } from "@/lib/workspace/types";

export function RescheduleButton({ tasks, className = BTN, label = "Fix my schedule" }: { tasks: Task[]; className?: string; label?: string }) {
  const { workspaceId, viewer } = useWs();
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState("7");
  const { run, pending, status } = useRun();
  const changes = useMemo(() => suggestReschedule(tasks), [tasks]);
  if (!viewer.canEdit) return null;

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Catch up on the plan" wide>
        {changes.length ? (
          <>
            <p className="text-dash-muted-foreground mb-3 text-sm">
              Unfinished late tasks restart today with the work that is left, and the tasks that depend on them move after
              them. Check the new dates, then apply.
            </p>
            <div className="border-dash-border max-h-80 overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-dash-muted/50 text-dash-muted-foreground text-left text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2">Task</th>
                    <th className="px-3 py-2">New dates</th>
                    <th className="px-3 py-2 text-right">Moves</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.id} className="border-dash-border border-t">
                      <td className="px-3 py-2">{c.title}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(c.start_date, { year: undefined })} – {formatDate(c.due_date, { year: undefined })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.shiftDays > 0 ? `+${c.shiftDays} d` : `${c.shiftDays} d`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                className={BTN}
                onClick={() =>
                  run(() => applyRescheduleAction(workspaceId, changes), { onOk: () => setOpen(false) })
                }
              >
                {pending ? "Applying…" : `Apply ${changes.length} new dates`}
              </button>
              <Status status={status} />
            </div>
          </>
        ) : (
          <p className="text-dash-muted-foreground text-sm">Nothing is late. Your plan is on time.</p>
        )}
        <div className="border-dash-border mt-5 border-t pt-4">
          <p className="text-dash-foreground mb-2 text-sm font-semibold">Or move every unfinished task</p>
          <div className="flex flex-wrap items-end gap-2">
            <Label text="Days (use minus to move earlier)">
              <input type="number" value={shift} onChange={(e) => setShift(e.target.value)} className={`${INPUT} w-32`} />
            </Label>
            <button
              type="button"
              disabled={pending}
              className={BTN_SOFT}
              onClick={() => run(() => shiftAllTasksAction(workspaceId, Number(shift)), { onOk: () => setOpen(false) })}
            >
              Move all
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function TemplateButton({
  hasTasks,
  category,
  start,
  end,
  className = BTN_SOFT,
}: {
  hasTasks: boolean;
  category: string | null;
  start: string | null;
  end: string | null;
  className?: string;
}) {
  const { workspaceId, viewer } = useWs();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(category ?? "fyp");
  const [s, setS] = useState(start ?? todayIso());
  const [e, setE] = useState(end ?? defaultEndDate());
  const [replace, setReplace] = useState(false);
  const { run, pending, status } = useRun();
  if (!viewer.canEdit) return null;

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        Ready-made plan
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a ready-made plan">
        <p className="text-dash-muted-foreground mb-4 text-sm">
          Get phases and tasks for your type of project, spread between the start and end dates. You can change every task
          afterwards.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="Plan" wide>
            <select value={cat} onChange={(ev) => setCat(ev.target.value)} className={INPUT}>
              {Object.entries(PLAN_TEMPLATES).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.label}
                </option>
              ))}
            </select>
          </Label>
          <Label text="Start">
            <input type="date" value={s} onChange={(ev) => setS(ev.target.value)} className={INPUT} />
          </Label>
          <Label text="End">
            <input type="date" value={e} onChange={(ev) => setE(ev.target.value)} className={INPUT} />
          </Label>
        </div>
        {hasTasks ? (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={replace} onChange={(ev) => setReplace(ev.target.checked)} />
            Replace my current phases and tasks (otherwise the plan is added to them)
          </label>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className={BTN}
            onClick={() =>
              run(() => applyTemplateAction(workspaceId, { category: cat, startDate: s, endDate: e, replace }), {
                onOk: () => setOpen(false),
              })
            }
          >
            {pending ? "Adding…" : "Add plan"}
          </button>
          <Status status={status} />
        </div>
      </Modal>
    </>
  );
}
