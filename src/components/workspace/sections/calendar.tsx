"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { deleteItemAction, saveItemAction } from "@/app/portal/workspace-actions";
import { tabHref, useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_DANGER, BTN_GHOST, BTN_SOFT, INPUT, Label, Modal, Panel, Status } from "@/components/workspace/ws-ui";
import { AGENDA_LABEL, AGENDA_TONE, buildAgenda, type AgendaItem } from "@/lib/workspace/agenda";
import { EVENT_KINDS } from "@/lib/workspace/constants";
import { addDays, formatDate, relativeDays, startOfMonth, startOfWeek } from "@/lib/workspace/dates";
import type { CalendarEvent, WorkspaceBundle } from "@/lib/workspace/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarSection({ bundle, today }: { bundle: WorkspaceBundle; today: string }) {
  const { viewer, basePath } = useWs();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);
  const agenda = useMemo(() => buildAgenda(bundle), [bundle]);
  const byDate = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const a of agenda) m.set(a.date, [...(m.get(a.date) ?? []), a]);
    return m;
  }, [agenda]);

  const gridStart = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthLabel = new Date(`${month}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const shiftMonth = (n: number) => {
    const d = new Date(`${month}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7) + "-01");
  };
  const dayItems = byDate.get(selected) ?? [];
  const upcoming = agenda.filter((a) => !a.done && a.date >= today && a.date <= addDays(today, 30));

  function openItem(a: AgendaItem) {
    if (a.key.startsWith("e-")) {
      const ev = bundle.events.find((e) => `e-${e.id}` === a.key);
      if (ev) setEditing(ev);
    }
  }

  return (
    <>
      <Panel
        title={monthLabel}
        actions={
          <>
            <button type="button" className={BTN_SOFT} onClick={() => shiftMonth(-1)} aria-label="Previous month">
              ←
            </button>
            <button
              type="button"
              className={BTN_SOFT}
              onClick={() => {
                setMonth(startOfMonth(today));
                setSelected(today);
              }}
            >
              Today
            </button>
            <button type="button" className={BTN_SOFT} onClick={() => shiftMonth(1)} aria-label="Next month">
              →
            </button>
            {viewer.canEdit ? (
              <button type="button" className={BTN} onClick={() => setEditing({ starts_on: selected, kind: "meeting" })}>
                Add event
              </button>
            ) : null}
          </>
        }
      >
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-dash-border bg-dash-border text-xs">
          {WEEKDAYS.map((w) => (
            <div key={w} className="bg-dash-muted/60 text-dash-muted-foreground px-2 py-1.5 text-center font-semibold">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const items = byDate.get(d) ?? [];
            const inMonth = d.slice(0, 7) === month.slice(0, 7);
            const isToday = d === today;
            const isSel = d === selected;
            return (
              <button
                type="button"
                key={d}
                onClick={() => setSelected(d)}
                onDoubleClick={() => viewer.canEdit && setEditing({ starts_on: d, kind: "meeting" })}
                className={`bg-dash-card hover:bg-dash-muted/50 flex min-h-16 flex-col items-stretch gap-0.5 p-1 text-left align-top sm:min-h-24 sm:p-1.5 ${
                  inMonth ? "" : "opacity-45"
                } ${isSel ? "ring-dash-accent relative z-[1] ring-2 ring-inset" : ""}`}
              >
                <span
                  className={`mb-0.5 inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-semibold ${
                    isToday ? "bg-dash-accent text-white" : "text-dash-foreground"
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                <span className="hidden flex-col gap-0.5 sm:flex">
                  {items.slice(0, 3).map((a) => (
                    <span
                      key={a.key}
                      className={`truncate rounded px-1 py-0.5 text-[10px] font-medium text-white ${AGENDA_TONE[a.kind]} ${a.done ? "opacity-50 line-through" : ""}`}
                    >
                      {a.time ? `${a.time} ` : ""}
                      {a.title}
                    </span>
                  ))}
                  {items.length > 3 ? <span className="text-dash-muted-foreground px-1 text-[10px]">+{items.length - 3} more</span> : null}
                </span>
                <span className="flex flex-wrap gap-0.5 sm:hidden">
                  {items.slice(0, 4).map((a) => (
                    <span key={a.key} className={`h-1.5 w-1.5 rounded-full ${AGENDA_TONE[a.kind]}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {(Object.keys(AGENDA_TONE) as (keyof typeof AGENDA_TONE)[]).map((k) => (
            <span key={k} className="text-dash-muted-foreground flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${AGENDA_TONE[k]}`} /> {AGENDA_LABEL[k]}
            </span>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={formatDate(selected, { weekday: "long" })}>
          {dayItems.length ? (
            <AgendaList items={dayItems} today={today} onOpen={openItem} basePath={basePath} />
          ) : (
            <p className="text-dash-muted-foreground text-sm">Nothing on this day.{viewer.canEdit ? " Double-click a day to add an event." : ""}</p>
          )}
        </Panel>
        <Panel title="Next 30 days">
          {upcoming.length ? (
            <AgendaList items={upcoming} today={today} onOpen={openItem} basePath={basePath} showDate />
          ) : (
            <p className="text-dash-muted-foreground text-sm">Nothing planned in the next 30 days.</p>
          )}
        </Panel>
      </div>

      <EventEditor event={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function AgendaList({
  items,
  today,
  onOpen,
  basePath,
  showDate,
}: {
  items: AgendaItem[];
  today: string;
  onOpen: (a: AgendaItem) => void;
  basePath: string;
  showDate?: boolean;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((a) => {
        const inner = (
          <>
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${AGENDA_TONE[a.kind]}`} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-medium ${a.done ? "text-dash-muted-foreground line-through" : "text-dash-foreground"}`}>{a.title}</span>
              <span className="text-dash-muted-foreground block text-xs">
                {a.sub}
                {showDate ? ` · ${formatDate(a.date, { weekday: "short", year: undefined })} (${relativeDays(a.date, today)})` : ""}
                {a.time ? ` · ${a.time}` : ""}
              </span>
            </span>
          </>
        );
        return (
          <li key={a.key}>
            {a.key.startsWith("e-") ? (
              <button type="button" onClick={() => onOpen(a)} className="hover:bg-dash-muted/60 flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left">
                {inner}
              </button>
            ) : (
              <Link href={tabHref(basePath, a.tab)} className="hover:bg-dash-muted/60 flex items-start gap-3 rounded-lg px-2 py-1.5">
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function EventEditor({ event, onClose }: { event: Partial<CalendarEvent> | null; onClose: () => void }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  if (!event) return null;
  const ro = !viewer.canEdit;
  return (
    <Modal open onClose={onClose} title={event.id ? "Edit event" : "New event"}>
      <form
        key={event.id ?? event.starts_on}
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const v = Object.fromEntries([...fd.entries()].map(([k, val]) => [k, String(val)]));
          run(() => saveItemAction(workspaceId, "event", event.id ?? null, v), { onOk: onClose });
        }}
      >
        <Label text="What" wide>
          <input name="title" required maxLength={160} defaultValue={event.title ?? ""} className={INPUT} disabled={ro} autoFocus />
        </Label>
        <Label text="Type">
          <select name="kind" defaultValue={event.kind ?? "meeting"} className={INPUT} disabled={ro}>
            {EVENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Date">
          <input name="starts_on" type="date" required defaultValue={event.starts_on ?? ""} className={INPUT} disabled={ro} />
        </Label>
        <Label text="From">
          <input name="start_time" type="time" defaultValue={event.start_time?.slice(0, 5) ?? ""} className={INPUT} disabled={ro} />
        </Label>
        <Label text="To">
          <input name="end_time" type="time" defaultValue={event.end_time?.slice(0, 5) ?? ""} className={INPUT} disabled={ro} />
        </Label>
        <Label text="Where" wide>
          <input name="location" maxLength={160} defaultValue={event.location ?? ""} className={INPUT} disabled={ro} />
        </Label>
        <Label text="Notes" wide>
          <textarea name="notes" rows={3} maxLength={2000} defaultValue={event.notes ?? ""} className={INPUT} disabled={ro} />
        </Label>
        {!ro ? (
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button type="submit" disabled={pending} className={BTN}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" className={BTN_GHOST} onClick={onClose}>
              Cancel
            </button>
            {event.id ? (
              <button
                type="button"
                className={`${BTN_DANGER} ml-auto`}
                onClick={() => window.confirm("Delete this event?") && run(() => deleteItemAction(workspaceId, "event", event.id!), { onOk: onClose })}
              >
                Delete
              </button>
            ) : null}
            <div className="w-full">
              <Status status={status} />
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
