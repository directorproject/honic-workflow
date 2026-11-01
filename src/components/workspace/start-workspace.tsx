"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptInviteAction, createWorkspaceAction } from "@/app/portal/workspace-actions";
import { BTN, BTN_SOFT, INPUT, Label, Panel, Status } from "@/components/workspace/ws-ui";
import { PROJECT_CATEGORIES } from "@/lib/portal/config";
import { defaultEndDate, todayIso } from "@/lib/workspace/dates";

const FEATURES = [
  ["Gantt chart and task board", "A ready-made plan for your project type that you can drag and adjust."],
  ["Calendar and reminders", "Supervisor meetings, university deadlines and alerts before due dates."],
  ["Documents, files and logbook", "Chapters with versions and feedback, all project files, a printable logbook."],
  ["Data, parts and references", "Charts of your test results, a budget tracker and IEEE or APA references."],
  ["Honic support", "Message Honic, book lab or meeting time, and see quotes and payments."],
  ["Reports and defence", "One-click progress reports and a defence checklist with practice questions."],
];

export function StartWorkspace({
  suggestedName,
  category,
  invites,
}: {
  suggestedName: string;
  category: string | null;
  invites: { token: string; projectName: string; invitedBy: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const today = todayIso();

  function go(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setStatus(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setStatus({ ok: false, message: res.message ?? "Something went wrong." });
    });
  }

  return (
    <div className="space-y-5">
      {invites.length ? (
        <Panel title="You are invited to a team">
          <ul className="space-y-2">
            {invites.map((i) => (
              <li key={i.token} className="border-dash-border flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-dash-foreground text-sm font-semibold">{i.projectName}</p>
                  <p className="text-dash-muted-foreground text-xs">Invited by {i.invitedBy}</p>
                </div>
                <button type="button" disabled={pending} className={BTN} onClick={() => go(() => acceptInviteAction(i.token))}>
                  Join this team
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Start your project workspace" subtitle="Plan, organise and keep everything about your project in one place, shared with your partner and Honic.">
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="bg-dash-muted/40 rounded-xl px-3 py-2.5">
              <p className="text-dash-foreground text-sm font-semibold">{t}</p>
              <p className="text-dash-muted-foreground text-xs">{d}</p>
            </div>
          ))}
        </div>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            go(() =>
              createWorkspaceAction({
                name: String(fd.get("name")),
                category: String(fd.get("category")),
                startDate: String(fd.get("start")),
                endDate: String(fd.get("end")),
                defenceDate: String(fd.get("defence")),
                withPlan: fd.get("plan") === "on",
              }),
            );
          }}
        >
          <Label text="Project title" wide>
            <input name="name" required maxLength={200} defaultValue={suggestedName} placeholder="Your project title" className={INPUT} />
          </Label>
          <Label text="Project type">
            <select name="category" defaultValue={category ?? "fyp"} className={INPUT}>
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Label>
          <Label text="Defence date (if known)">
            <input name="defence" type="date" className={INPUT} />
          </Label>
          <Label text="Start">
            <input name="start" type="date" required defaultValue={today} className={INPUT} />
          </Label>
          <Label text="Finish by">
            <input name="end" type="date" required defaultValue={defaultEndDate(today)} className={INPUT} />
          </Label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="plan" defaultChecked />
            Add a ready-made plan (phases, tasks and milestones) between these dates
          </label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={pending} className={BTN}>
              {pending ? "Creating…" : "Create my workspace"}
            </button>
            <Status status={status} />
          </div>
        </form>
      </Panel>
    </div>
  );
}

export function JoinInvite({ token, projectName }: { token: string; projectName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <Panel title={`Join "${projectName}"`} subtitle="You will share the plan, documents, files and messages with your team.">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          className={BTN}
          onClick={() =>
            startTransition(async () => {
              const res = await acceptInviteAction(token);
              if (res.ok) router.push("/portal");
              else setStatus({ ok: false, message: res.message });
            })
          }
        >
          {pending ? "Joining…" : "Join the team"}
        </button>
        <a href="/portal" className={BTN_SOFT}>
          Not now
        </a>
      </div>
      <div className="mt-3">
        <Status status={status} />
      </div>
    </Panel>
  );
}
