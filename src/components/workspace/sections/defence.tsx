"use client";

import { useState } from "react";

import { deleteItemAction, saveItemAction, updateWorkspaceAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_DANGER, BTN_GHOST, Countdown, INPUT, Label, Panel, ProgressBar, Status } from "@/components/workspace/ws-ui";
import type { DefenceItem } from "@/lib/workspace/types";

export function DefenceSection({ items, defenceDate, today }: { items: DefenceItem[]; defenceDate: string | null; today: string }) {
  const { workspaceId, viewer } = useWs();
  const { run, status } = useRun();
  const checks = items.filter((i) => i.kind === "check");
  const questions = items.filter((i) => i.kind === "question");
  const ready = items.length ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0;
  const [date, setDate] = useState(defenceDate ?? "");

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-56 flex-1">
            <p className="text-dash-foreground text-base font-semibold">Defence preparation</p>
            <p className="text-dash-muted-foreground mb-3 text-sm">Tick items as you finish them and practise answering the questions out loud.</p>
            <ProgressBar value={ready} />
            <p className="text-dash-muted-foreground mt-1 text-xs">{ready}% ready</p>
          </div>
          {defenceDate ? (
            <Countdown date={defenceDate} label="defence" today={today} />
          ) : viewer.canEdit ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => updateWorkspaceAction(workspaceId, { defence_date: date }));
              }}
            >
              <Label text="Defence date">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} required />
              </Label>
              <button type="submit" className={BTN}>
                Set
              </button>
            </form>
          ) : null}
        </div>
        <Status status={status} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <ItemList title="Checklist" kind="check" items={checks} />
        <ItemList title="Practice questions" kind="question" items={questions} />
      </div>
    </>
  );
}

function ItemList({ title, kind, items }: { title: string; kind: "check" | "question"; items: DefenceItem[] }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const [text, setText] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Panel title={title} subtitle={kind === "question" ? "Write a short answer for each, then mark it practised." : undefined}>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="border-dash-border rounded-xl border px-3 py-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={i.done}
                disabled={!viewer.canEdit || pending}
                onChange={() => run(() => saveItemAction(workspaceId, "defence", i.id, { done: !i.done }, { quiet: true }))}
                aria-label={kind === "check" ? "Done" : "Practised"}
              />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(openId === i.id ? null : i.id)}>
                <p className={`text-sm ${i.done ? "text-dash-muted-foreground line-through" : "text-dash-foreground"}`}>{i.text}</p>
                {kind === "question" && i.answer && openId !== i.id ? <p className="text-dash-muted-foreground mt-0.5 line-clamp-1 text-xs">{i.answer}</p> : null}
              </button>
              {viewer.canEdit ? (
                <button type="button" className={BTN_DANGER} aria-label="Delete" onClick={() => run(() => deleteItemAction(workspaceId, "defence", i.id))}>
                  ✕
                </button>
              ) : null}
            </div>
            {kind === "question" && openId === i.id ? (
              <textarea
                defaultValue={i.answer ?? ""}
                rows={4}
                maxLength={3000}
                disabled={!viewer.canEdit}
                placeholder="Your answer in a few sentences"
                onBlur={(e) => e.target.value !== (i.answer ?? "") && run(() => saveItemAction(workspaceId, "defence", i.id, { answer: e.target.value }, { quiet: true }))}
                className={`${INPUT} mt-2`}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {viewer.canEdit ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveItemAction(workspaceId, "defence", null, { kind, text, sort_order: items.length }), { onOk: () => setText("") });
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} required maxLength={400} placeholder={kind === "check" ? "Add an item" : "Add a question you expect"} className={INPUT} />
          <button type="submit" disabled={pending} className={BTN_GHOST}>
            Add
          </button>
        </form>
      ) : null}
      <Status status={status} />
    </Panel>
  );
}
