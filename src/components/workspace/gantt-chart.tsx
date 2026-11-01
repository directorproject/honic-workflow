"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { saveItemAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { Status } from "@/components/workspace/ws-ui";
import { phaseColor } from "@/lib/workspace/constants";
import { addDays, formatDate, fromDays, toDays } from "@/lib/workspace/dates";
import type { Phase, Task, Workspace } from "@/lib/workspace/types";

export type Zoom = "day" | "week" | "month";
const PX: Record<Zoom, number> = { day: 34, week: 13, month: 4.5 };
const ROW = 38;

type Row =
  | { type: "phase"; phase: Phase | null; tasks: Task[]; start: string | null; due: string | null; done: number }
  | { type: "task"; task: Task };

type Drag = { id: string; mode: "move" | "start" | "end"; x0: number; start: string; due: string; moved: boolean };

export function GanttChart({
  workspace,
  phases,
  tasks,
  zoom,
  today,
  onOpenTask,
  printMode = false,
}: {
  workspace: Workspace;
  phases: Phase[];
  tasks: Task[];
  zoom: Zoom;
  today: string;
  onOpenTask?: (t: Task) => void;
  printMode?: boolean;
}) {
  const { workspaceId, viewer } = useWs();
  const { run, status } = useRun();
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [override, setOverride] = useState<Record<string, { start: string; due: string }>>({});
  const px = PX[zoom];
  const left = printMode ? 230 : 190;
  const editable = viewer.canEdit && !printMode;

  const dated = useMemo(
    () =>
      tasks.map((t) => {
        const o = override[t.id];
        const start = o?.start ?? t.start_date ?? t.due_date;
        const due = o?.due ?? t.due_date ?? t.start_date;
        return { ...t, start_date: start, due_date: due };
      }),
    [tasks, override],
  );

  const range = useMemo(() => {
    const dates = [
      ...dated.flatMap((t) => [t.start_date, t.due_date]),
      workspace.start_date,
      workspace.end_date,
      workspace.defence_date,
      printMode ? null : today,
    ].filter((d): d is string => Boolean(d));
    const min = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : today;
    const max = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : addDays(today, 60);
    const start = zoom === "month" ? `${min.slice(0, 7)}-01` : addDays(min, -3);
    return { start, days: Math.max(30, toDays(max) - toDays(start) + (zoom === "month" ? 20 : 8)) };
  }, [dated, workspace, today, zoom, printMode]);

  const x = (iso: string) => (toDays(iso) - toDays(range.start)) * px;
  const width = range.days * px;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    const groups: (Phase | null)[] = [...phases, null];
    for (const p of groups) {
      const list = dated.filter((t) => (p ? t.phase_id === p.id : !t.phase_id || !phases.some((ph) => ph.id === t.phase_id)));
      if (!list.length && !p) continue;
      const starts = list.map((t) => t.start_date).filter((d): d is string => Boolean(d));
      const dues = list.map((t) => t.due_date).filter((d): d is string => Boolean(d));
      const done = list.length ? Math.round((list.filter((t) => t.status === "done").length / list.length) * 100) : 0;
      out.push({ type: "phase", phase: p, tasks: list, start: starts.sort()[0] ?? null, due: dues.sort().pop() ?? null, done });
      for (const t of list) out.push({ type: "task", task: t });
    }
    return out;
  }, [phases, dated]);

  const rowIndex = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => r.type === "task" && m.set(r.task.id, i));
    return m;
  }, [rows]);

  useEffect(() => {
    if (printMode || !scroller.current) return;
    scroller.current.scrollLeft = Math.max(0, x(today) - 160);
    // Only when the zoom changes; keep the user's scroll otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const ticks = useMemo(() => {
    const months: { label: string; x: number; w: number }[] = [];
    const minor: { label: string; x: number; weekend?: boolean }[] = [];
    const startD = toDays(range.start);
    for (let i = 0; i < range.days; i++) {
      const iso = fromDays(startD + i);
      const d = new Date(`${iso}T00:00:00Z`);
      if (i === 0 || d.getUTCDate() === 1) {
        months.push({ label: d.toLocaleDateString("en-GB", { month: zoom === "month" ? "short" : "long", year: "numeric", timeZone: "UTC" }), x: i * px, w: 0 });
      }
      if (zoom === "day") minor.push({ label: String(d.getUTCDate()), x: i * px, weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6 });
      else if (zoom === "week" && d.getUTCDay() === 1) minor.push({ label: String(d.getUTCDate()), x: i * px });
    }
    months.forEach((m, i) => (m.w = (months[i + 1]?.x ?? range.days * px) - m.x));
    return { months, minor };
  }, [range, px, zoom]);

  function onPointerDown(e: ReactPointerEvent, t: Task, mode: Drag["mode"]) {
    if (!editable || !t.start_date || !t.due_date) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort (for example synthetic pointers) */
    }
    setDrag({ id: t.id, mode, x0: e.clientX, start: t.start_date, due: t.due_date, moved: false });
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!drag) return;
    const delta = Math.round((e.clientX - drag.x0) / px);
    if (delta === 0 && !drag.moved) return;
    let { start, due } = drag;
    if (drag.mode === "move") {
      start = addDays(drag.start, delta);
      due = addDays(drag.due, delta);
    } else if (drag.mode === "start") {
      start = addDays(drag.start, delta);
      if (start > due) start = due;
    } else {
      due = addDays(drag.due, delta);
      if (due < start) due = start;
    }
    if (!drag.moved) setDrag({ ...drag, moved: true });
    setOverride((o) => ({ ...o, [drag.id]: { start, due } }));
  }

  function onPointerUp(t: Task) {
    if (!drag) return;
    const o = override[drag.id];
    const wasMoved = drag.moved;
    setDrag(null);
    if (!wasMoved) {
      onOpenTask?.(t);
      return;
    }
    if (o && (o.start !== drag.start || o.due !== drag.due)) {
      run(() => saveItemAction(workspaceId, "task", drag.id, { start_date: o.start, due_date: o.due }), {
        onOk: () => setOverride((cur) => {
          const next = { ...cur };
          delete next[drag.id];
          return next;
        }),
      });
    }
  }

  const height = rows.length * ROW;
  const todayX = x(today);
  const defenceX = workspace.defence_date ? x(workspace.defence_date) : null;

  return (
    <div>
      <div ref={scroller} className={`border-dash-border relative rounded-xl border ${printMode ? "" : "overflow-x-auto"}`}>
        <div style={{ width: left + width }} className="relative select-none">
          <div className="bg-dash-card border-dash-border sticky top-0 z-20 flex border-b">
            <div style={{ width: left }} className="bg-dash-card border-dash-border sticky left-0 z-30 shrink-0 border-r px-3 py-2 text-xs font-semibold uppercase">
              <span className="text-dash-muted-foreground">Task</span>
            </div>
            <div className="relative" style={{ width, height: zoom === "month" ? 28 : 46 }}>
              {ticks.months.map((m) => (
                <div key={m.x} className="border-dash-border text-dash-foreground absolute top-0 truncate border-l px-1.5 pt-1 text-xs font-semibold" style={{ left: m.x, width: m.w }}>
                  {m.label}
                </div>
              ))}
              {ticks.minor.map((m) => (
                <div
                  key={m.x}
                  className={`border-dash-border/60 absolute bottom-0 border-l text-center text-[10px] ${m.weekend ? "text-dash-muted-foreground/60" : "text-dash-muted-foreground"}`}
                  style={{ left: m.x, width: zoom === "day" ? px : 7 * px, height: 18 }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          <div className="relative" style={{ height }}>
            {zoom === "day"
              ? ticks.minor
                  .filter((m) => m.weekend)
                  .map((m) => <div key={m.x} className="bg-dash-muted/40 absolute top-0 bottom-0" style={{ left: left + m.x, width: px }} />)
              : null}

            {rows.map((r, i) => (
              <div key={r.type === "phase" ? `p-${r.phase?.id ?? "none"}` : r.task.id} className="border-dash-border/60 absolute right-0 left-0 flex border-b" style={{ top: i * ROW, height: ROW }}>
                <div
                  style={{ width: left }}
                  className={`bg-dash-card border-dash-border sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r px-3 text-sm ${r.type === "phase" ? "font-semibold" : "pl-6"}`}
                >
                  {r.type === "phase" ? (
                    <>
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${phaseColor(r.phase?.color).bar}`} />
                      <span className="text-dash-foreground truncate">{r.phase?.name ?? "Other tasks"}</span>
                      <span className="text-dash-muted-foreground ml-auto text-[11px] font-normal tabular-nums">{r.done}%</span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenTask?.(r.task)}
                      className={`truncate text-left ${r.task.status === "done" ? "text-dash-muted-foreground line-through" : "text-dash-foreground"}`}
                      title={r.task.title}
                    >
                      {r.task.title}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <svg className="pointer-events-none absolute top-0" style={{ left, width, height }} aria-hidden>
              <defs>
                <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" className="fill-slate-400" />
                </marker>
              </defs>
              {dated.flatMap((t) =>
                t.depends_on.map((d) => {
                  const from = dated.find((p) => p.id === d);
                  const fi = rowIndex.get(d);
                  const ti = rowIndex.get(t.id);
                  if (!from?.due_date || !t.start_date || fi === undefined || ti === undefined) return null;
                  const x1 = x(addDays(from.due_date, 1)) - 1;
                  const y1 = fi * ROW + ROW / 2;
                  const x2 = x(t.start_date) - 2;
                  const y2 = ti * ROW + ROW / 2;
                  const mid = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
                  return (
                    <path
                      key={`${d}-${t.id}`}
                      d={`M${x1},${y1} H${mid} V${y2} H${x2}`}
                      className="fill-none stroke-slate-400"
                      strokeWidth={1.2}
                      markerEnd="url(#gantt-arrow)"
                      opacity={0.7}
                    />
                  );
                }),
              )}
            </svg>

            {!printMode ? <div className="bg-rose-500 absolute top-0 bottom-0 z-[5] w-0.5" style={{ left: left + todayX }} title="Today" /> : null}
            {defenceX !== null ? <div className="absolute top-0 bottom-0 z-[5] w-0.5 bg-fuchsia-500/70" style={{ left: left + defenceX }} title="Defence day" /> : null}

            {rows.map((r, i) => {
              if (r.type === "phase") {
                if (!r.start || !r.due) return null;
                const c = phaseColor(r.phase?.color);
                return (
                  <div
                    key={`pb-${r.phase?.id ?? "none"}`}
                    className={`absolute rounded ${c.soft}`}
                    style={{ left: left + x(r.start), width: Math.max(px, x(addDays(r.due, 1)) - x(r.start)), top: i * ROW + 14, height: 10 }}
                  >
                    <div className={`h-full rounded ${c.bar} opacity-70`} style={{ width: `${r.done}%` }} />
                  </div>
                );
              }
              const t = r.task;
              if (!t.start_date || !t.due_date) return null;
              const phase = phases.find((p) => p.id === t.phase_id);
              const c = phaseColor(phase?.color);
              const late = t.status !== "done" && t.due_date < today;
              if (t.is_milestone) {
                return (
                  <button
                    key={`b-${t.id}`}
                    type="button"
                    onPointerDown={(e) => onPointerDown(e, t, "move")}
                    onPointerMove={onPointerMove}
                    onPointerUp={() => onPointerUp(t)}
                    onClick={(e) => !editable && (e.preventDefault(), onOpenTask?.(t))}
                    className={`absolute z-10 flex items-center gap-1.5 ${editable ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
                    style={{ left: left + x(t.start_date) + px / 2 - 8, top: i * ROW + 11 }}
                    title={`${t.title} · ${formatDate(t.start_date)}`}
                  >
                    <span className={`block h-4 w-4 rotate-45 rounded-[3px] ${t.status === "done" ? "bg-emerald-500" : late ? "bg-rose-500" : "bg-violet-500"}`} />
                    {zoom !== "month" ? <span className="text-dash-foreground text-[11px] font-semibold whitespace-nowrap">{t.title}</span> : null}
                  </button>
                );
              }
              const barLeft = x(t.start_date);
              const barW = Math.max(px * 0.8, x(addDays(t.due_date, 1)) - barLeft - 2);
              return (
                <div
                  key={`b-${t.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onOpenTask?.(t)}
                  onPointerDown={(e) => onPointerDown(e, t, "move")}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => onPointerUp(t)}
                  onClick={() => !editable && onOpenTask?.(t)}
                  className={`group absolute z-10 overflow-hidden rounded-md shadow-sm ${late ? "ring-2 ring-rose-500" : ""} ${
                    editable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer"
                  } ${drag?.id === t.id ? "opacity-90 ring-2 ring-white/70" : ""}`}
                  style={{ left: left + barLeft + 1, width: barW, top: i * ROW + 7, height: ROW - 14 }}
                  title={`${t.title}\n${formatDate(t.start_date)} – ${formatDate(t.due_date)} · ${t.status === "done" ? 100 : t.progress}%`}
                >
                  <div className={`absolute inset-0 ${c.bar} opacity-60`} />
                  <div className={`absolute inset-y-0 left-0 ${t.status === "done" ? "bg-emerald-500" : c.bar}`} style={{ width: `${t.status === "done" ? 100 : t.progress}%` }} />
                  {barW > 60 ? (
                    <span className="relative z-[1] block truncate px-2 text-[11px] leading-6 font-semibold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.45)]">{t.title}</span>
                  ) : null}
                  {editable ? (
                    <>
                      <span
                        onPointerDown={(e) => onPointerDown(e, t, "start")}
                        className="absolute inset-y-0 left-0 z-[2] w-2 cursor-ew-resize bg-black/0 group-hover:bg-black/20"
                      />
                      <span
                        onPointerDown={(e) => onPointerDown(e, t, "end")}
                        className="absolute inset-y-0 right-0 z-[2] w-2 cursor-ew-resize bg-black/0 group-hover:bg-black/20"
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
        <span className="text-dash-muted-foreground flex items-center gap-1.5"><span className="h-3 w-0.5 bg-rose-500" /> Today</span>
        {workspace.defence_date ? <span className="text-dash-muted-foreground flex items-center gap-1.5"><span className="h-3 w-0.5 bg-fuchsia-500" /> Defence</span> : null}
        <span className="text-dash-muted-foreground flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-violet-500" /> Milestone</span>
        <span className="text-dash-muted-foreground flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm ring-2 ring-rose-500" /> Late</span>
        {editable ? <span className="text-dash-muted-foreground">Drag a bar to move it, drag its ends to change dates, click to edit.</span> : null}
        <Status status={status} />
      </div>
    </div>
  );
}
