"use client";

import { useMemo, useState } from "react";

import { deleteItemAction, saveItemAction } from "@/app/portal/workspace-actions";
import { CommentsThread } from "@/components/workspace/comments";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_DANGER, BTN_GHOST, BTN_SOFT, Empty, INPUT, Label, Panel, Status } from "@/components/workspace/ws-ui";
import { addDays, formatDate, startOfWeek } from "@/lib/workspace/dates";
import type { Comment, LogEntry } from "@/lib/workspace/types";

export function LogbookSection({
  entries,
  comments,
  today,
  printHref,
}: {
  entries: LogEntry[];
  comments: Comment[];
  today: string;
  printHref: string;
}) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [formKey, setFormKey] = useState(0);

  const weeks = useMemo(() => {
    const m = new Map<string, LogEntry[]>();
    for (const e of entries) {
      const w = startOfWeek(e.entry_date);
      m.set(w, [...(m.get(w) ?? []), e]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);
  const totalHours = entries.reduce((s, e) => s + Number(e.hours ?? 0), 0);

  return (
    <>
      {viewer.canEdit ? (
        <Panel title={editing ? "Edit entry" : "New logbook entry"} subtitle="Write what you did, what went wrong and what is next. Short and honest is best.">
          <form
            key={editing?.id ?? `new-${formKey}`}
            className="grid gap-3 sm:grid-cols-[10rem_7rem_1fr]"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const v = Object.fromEntries([...fd.entries()].map(([k, val]) => [k, String(val)]));
              run(() => saveItemAction(workspaceId, "logbook", editing?.id ?? null, v), {
                onOk: () => {
                  setEditing(null);
                  setFormKey((k) => k + 1);
                },
              });
            }}
          >
            <Label text="Date">
              <input name="entry_date" type="date" required defaultValue={editing?.entry_date ?? today} max={addDays(today, 1)} className={INPUT} />
            </Label>
            <Label text="Hours">
              <input name="hours" type="number" min={0} max={24} step={0.5} defaultValue={editing?.hours ?? ""} className={INPUT} />
            </Label>
            <div className="hidden sm:block" />
            <div className="grid gap-3 sm:col-span-3 md:grid-cols-3">
              <Label text="Work done">
                <textarea name="work_done" required rows={4} maxLength={4000} defaultValue={editing?.work_done ?? ""} className={INPUT} />
              </Label>
              <Label text="Problems">
                <textarea name="problems" rows={4} maxLength={3000} defaultValue={editing?.problems ?? ""} className={INPUT} />
              </Label>
              <Label text="Next steps">
                <textarea name="next_steps" rows={4} maxLength={3000} defaultValue={editing?.next_steps ?? ""} className={INPUT} />
              </Label>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
              <button type="submit" disabled={pending} className={BTN}>
                {pending ? "Saving…" : editing ? "Save changes" : "Add entry"}
              </button>
              {editing ? (
                <button type="button" className={BTN_GHOST} onClick={() => setEditing(null)}>
                  Cancel
                </button>
              ) : null}
              <Status status={status} />
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel
        title="Logbook"
        subtitle={`${entries.length} ${entries.length === 1 ? "entry" : "entries"} · ${totalHours} hours in total`}
        actions={
          viewer.kind !== "supervisor" ? (
            <a href={printHref} target="_blank" rel="noreferrer" className={BTN_SOFT}>
              Print or save as PDF
            </a>
          ) : null
        }
      >
        {weeks.length ? (
          <div className="space-y-6">
            {weeks.map(([week, list]) => (
              <div key={week}>
                <p className="text-dash-muted-foreground mb-2 text-xs font-semibold uppercase">
                  Week of {formatDate(week)} · {list.reduce((s, e) => s + Number(e.hours ?? 0), 0)} h
                </p>
                <ul className="space-y-3">
                  {list.map((e) => (
                    <li key={e.id} className="border-dash-border rounded-xl border p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="text-dash-foreground text-sm font-semibold">{formatDate(e.entry_date, { weekday: "long" })}</p>
                        {e.hours ? <span className="text-dash-muted-foreground text-xs">{e.hours} h</span> : null}
                        <span className="text-dash-muted-foreground text-xs">· {e.author_name}</span>
                        {viewer.canEdit ? (
                          <span className="ml-auto flex gap-1">
                            <button type="button" className={BTN_GHOST} onClick={() => setEditing(e)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className={BTN_DANGER}
                              onClick={() => window.confirm("Delete this entry?") && run(() => deleteItemAction(workspaceId, "logbook", e.id))}
                            >
                              Delete
                            </button>
                          </span>
                        ) : null}
                      </div>
                      <div className="grid gap-3 text-sm md:grid-cols-3">
                        <Block title="Work done" text={e.work_done} />
                        <Block title="Problems" text={e.problems} />
                        <Block title="Next steps" text={e.next_steps} />
                      </div>
                      <CommentsThread targetType="logbook" targetId={e.id} comments={comments} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No entries yet">Many institutions ask for a logbook signed by the supervisor. Add an entry after each work day.</Empty>
        )}
      </Panel>
    </>
  );
}

function Block({ title, text }: { title: string; text: string | null }) {
  return (
    <div>
      <p className="text-dash-muted-foreground text-[11px] font-semibold uppercase">{title}</p>
      <p className="text-dash-foreground whitespace-pre-wrap">{text || "—"}</p>
    </div>
  );
}
