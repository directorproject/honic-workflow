"use client";

import Link from "next/link";

import { saveItemAction } from "@/app/portal/workspace-actions";
import { RescheduleButton, TemplateButton } from "@/components/workspace/plan-tools";
import { ActivityList } from "@/components/workspace/sections/activity";
import { tabHref, useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN_SOFT, Countdown, Empty, Panel, ProgressBar, Stat, Status } from "@/components/workspace/ws-ui";
import { projectCategoryLabel } from "@/lib/portal/config";
import { AGENDA_LABEL, AGENDA_TONE, buildAgenda } from "@/lib/workspace/agenda";
import { formatTsh } from "@/lib/workspace/constants";
import { addDays, formatDate, relativeDays, startOfWeek } from "@/lib/workspace/dates";
import { scheduleHealth } from "@/lib/workspace/schedule";
import type { Task, WorkspaceBundle } from "@/lib/workspace/types";

const STATE_TEXT = {
  on_track: { text: "On track", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  slightly_behind: { text: "Slightly behind", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  behind: { text: "Behind schedule", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  empty: { text: "No plan yet", tone: "bg-slate-500/15 text-dash-muted-foreground" },
};

export function HomeSection({ bundle, today, basePath }: { bundle: WorkspaceBundle; today: string; basePath: string }) {
  const { viewer } = useWs();
  const ws = bundle.workspace;
  const health = scheduleHealth(bundle.tasks, today);
  const agenda = buildAgenda(bundle).filter((a) => !a.done && a.date >= today && a.date <= addDays(today, 14));
  const nextDeadline = agenda.find((a) => a.kind !== "task");
  const weekStart = startOfWeek(today);
  const weekLogs = bundle.logbook.filter((l) => l.entry_date >= weekStart);
  const spent = bundle.parts.filter((p) => p.status !== "needed").reduce((s, p) => s + p.quantity * p.unit_price_tsh, 0);
  const planned = bundle.parts.reduce((s, p) => s + p.quantity * p.unit_price_tsh, 0);
  const docsApproved = bundle.documents.filter((d) => d.status === "approved").length;
  const unread =
    viewer.kind === "supervisor"
      ? 0
      : bundle.messages.filter((m) =>
          viewer.kind === "staff" ? m.author_kind !== "staff" && !m.staff_read_at : m.author_kind === "staff" && !m.student_read_at,
        ).length;
  const focus = [...health.overdue, ...health.dueSoon].slice(0, 8);
  const state = STATE_TEXT[health.state];

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {ws.project_category ? <Badge className="bg-dash-accent/15 text-dash-accent">{projectCategoryLabel(ws.project_category)}</Badge> : null}
              <Badge className={state.tone}>{state.text}</Badge>
            </div>
            <h2 className="text-dash-foreground mt-2 text-xl font-semibold tracking-tight">{ws.name}</h2>
            <p className="text-dash-muted-foreground mt-1 text-sm">
              {bundle.members.map((m) => m.full_name).join(", ")}
              {ws.start_date ? ` · ${formatDate(ws.start_date)} to ${formatDate(ws.end_date)}` : ""}
            </p>
          </div>
          <div className="flex gap-6">
            {nextDeadline ? <Countdown date={nextDeadline.date} label={nextDeadline.title.toLowerCase().slice(0, 28)} today={today} /> : null}
            <Countdown date={ws.defence_date} label="defence" today={today} />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-dash-foreground font-semibold">{health.actual}% done</span>
            <span className="text-dash-muted-foreground">Plan says {health.planned}% by today</span>
          </div>
          <ProgressBar value={health.actual} planned={health.planned} />
        </div>

        {health.state === "behind" || health.state === "slightly_behind" ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <p className="text-amber-900 dark:text-amber-100">
              {health.overdue.length
                ? `${health.overdue.length} task${health.overdue.length === 1 ? " is" : "s are"} late. `
                : ""}
              You are {Math.max(0, health.planned - health.actual)} points behind the plan.
            </p>
            <RescheduleButton tasks={bundle.tasks} />
          </div>
        ) : null}
        {health.state === "empty" ? (
          <div className="border-dash-border mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-sm">
            <p className="text-dash-muted-foreground">Start with a ready-made plan for your project type, then adjust the dates.</p>
            <TemplateButton hasTasks={false} category={ws.project_category} start={ws.start_date} end={ws.end_date} />
          </div>
        ) : null}
      </Panel>

      {unread ? (
        <Link
          href={tabHref(basePath, "messages")}
          className="block rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-800 dark:text-rose-100"
        >
          {unread} new message{unread === 1 ? "" : "s"} {viewer.kind === "staff" ? "from the students" : "from Honic"}. Open messages →
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tasks done" value={`${health.doneCount}/${health.total}`} hint={health.overdue.length ? `${health.overdue.length} late` : "None late"} />
        <Stat
          label="Logbook this week"
          value={weekLogs.length}
          hint={`${weekLogs.reduce((s, l) => s + Number(l.hours ?? 0), 0)} hours recorded`}
        />
        <Stat
          label="Spent on parts"
          value={formatTsh(spent)}
          hint={ws.budget_tsh ? `of ${formatTsh(ws.budget_tsh)} budget` : `of ${formatTsh(planned)} planned`}
          tone={ws.budget_tsh && spent > ws.budget_tsh ? "text-rose-600 dark:text-rose-300" : ""}
        />
        <Stat label="Documents approved" value={`${docsApproved}/${bundle.documents.length}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Focus now"
          subtitle="Late tasks and tasks due in the next 7 days."
          actions={
            <Link href={tabHref(basePath, "tasks")} className={BTN_SOFT}>
              Task board
            </Link>
          }
        >
          {focus.length ? (
            <ul className="space-y-2">
              {focus.map((t) => (
                <FocusTask key={t.id} task={t} today={today} />
              ))}
            </ul>
          ) : (
            <Empty title="Nothing due this week">Use the Gantt chart or task board to plan the next steps.</Empty>
          )}
        </Panel>

        <Panel
          title="Next 14 days"
          actions={
            <Link href={tabHref(basePath, "calendar")} className={BTN_SOFT}>
              Calendar
            </Link>
          }
        >
          {agenda.length ? (
            <ul className="space-y-2">
              {agenda.slice(0, 10).map((a) => (
                <li key={a.key}>
                  <Link href={tabHref(basePath, a.tab)} className="hover:bg-dash-muted/60 flex items-start gap-3 rounded-lg px-2 py-1.5">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${AGENDA_TONE[a.kind]}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="text-dash-foreground block truncate text-sm font-medium">{a.title}</span>
                      <span className="text-dash-muted-foreground block text-xs">
                        {AGENDA_LABEL[a.kind]} · {formatDate(a.date, { weekday: "short", year: undefined })}
                        {a.time ? ` ${a.time}` : ""} · {relativeDays(a.date, today)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nothing in the next two weeks" />
          )}
        </Panel>
      </div>

      <ActivityList activity={bundle.activity} />
    </>
  );
}

function FocusTask({ task, today }: { task: Task; today: string }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const late = task.due_date && task.due_date < today;
  return (
    <li className="border-dash-border flex items-center gap-3 rounded-xl border px-3 py-2">
      <input
        type="checkbox"
        aria-label={`Mark ${task.title} done`}
        disabled={pending || !viewer.canEdit}
        checked={task.status === "done"}
        onChange={() => run(() => saveItemAction(workspaceId, "task", task.id, { status: "done" }))}
        className="h-4 w-4 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-dash-foreground truncate text-sm font-medium">{task.title}</p>
        <p className={`text-xs ${late ? "font-semibold text-rose-600 dark:text-rose-300" : "text-dash-muted-foreground"}`}>
          {late ? "Late: " : "Due "}
          {formatDate(task.due_date, { year: undefined })} ({relativeDays(task.due_date ?? today, today)})
        </p>
        <Status status={status} />
      </div>
      {task.priority === "high" ? <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300">High</Badge> : null}
    </li>
  );
}
