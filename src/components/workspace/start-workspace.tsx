"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptInviteAction, createWorkspaceAction } from "@/app/portal/workspace-actions";
import { BTN, BTN_SOFT, INPUT, Label, Panel, Status } from "@/components/workspace/ws-ui";
import { PROJECT_CATEGORIES } from "@/lib/portal/config";
import { defaultEndDate, todayIso } from "@/lib/workspace/dates";

const HIGHLIGHTS = [
  "Plan with Gantt, tasks and calendar",
  "Review documents with your supervisor",
  "Logbook, files, parts and references in one place",
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

      <section className="border-dash-border from-dash-card to-dash-muted/40 overflow-hidden rounded-2xl border bg-gradient-to-br px-5 py-6 shadow-sm sm:px-7 sm:py-8">
        <p className="text-dash-accent text-xs font-semibold tracking-wide uppercase">Student workspace</p>
        <h1 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Start your project</h1>
        <p className="text-dash-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
          One place for your plan, review documents, files and team, shared with your partner and Honic.
        </p>
        <ul className="text-dash-muted-foreground mt-4 space-y-1.5 text-sm">
          {HIGHLIGHTS.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-dash-accent font-semibold" aria-hidden>
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <Panel title="Create workspace" subtitle="Use your selected title if you have one, then set dates.">
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
