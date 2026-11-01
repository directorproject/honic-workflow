import { labelOf, EVENT_KINDS } from "@/lib/workspace/constants";
import type { WorkspaceBundle } from "@/lib/workspace/types";

export type AgendaKind = "task" | "milestone" | "event" | "deadline" | "session" | "document" | "defence";

export type AgendaItem = {
  key: string;
  date: string;
  time: string | null;
  title: string;
  kind: AgendaKind;
  sub: string;
  done: boolean;
  tab: string;
};

export const AGENDA_TONE: Record<AgendaKind, string> = {
  task: "bg-sky-500",
  milestone: "bg-violet-500",
  event: "bg-emerald-500",
  deadline: "bg-rose-500",
  session: "bg-cyan-500",
  document: "bg-amber-500",
  defence: "bg-fuchsia-500",
};

export const AGENDA_LABEL: Record<AgendaKind, string> = {
  task: "Task due",
  milestone: "Milestone",
  event: "Event",
  deadline: "University deadline",
  session: "Honic session",
  document: "Document due",
  defence: "Defence",
};

function eatParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(d);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam" });
  return { date, time };
}

/** Every dated thing in the workspace, sorted by date. */
export function buildAgenda(b: WorkspaceBundle): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const t of b.tasks) {
    if (!t.due_date) continue;
    items.push({
      key: `t-${t.id}`,
      date: t.due_date,
      time: null,
      title: t.title,
      kind: t.is_milestone ? "milestone" : "task",
      sub: t.is_milestone ? "Milestone" : "Task due",
      done: t.status === "done",
      tab: "tasks",
    });
  }
  for (const e of b.events) {
    items.push({
      key: `e-${e.id}`,
      date: e.starts_on,
      time: e.start_time ? e.start_time.slice(0, 5) : null,
      title: e.title,
      kind: e.kind === "deadline" ? "deadline" : "event",
      sub: [labelOf(EVENT_KINDS, e.kind), e.location].filter(Boolean).join(" · "),
      done: false,
      tab: "calendar",
    });
  }
  for (const d of b.deadlines) {
    items.push({ key: `d-${d.id}`, date: d.due_date, time: null, title: d.title, kind: "deadline", sub: "Set by Honic for your institution", done: false, tab: "calendar" });
  }
  for (const s of b.bookings) {
    if (s.status !== "confirmed" && s.status !== "requested") continue;
    const when = eatParts(s.confirmed_at ?? s.preferred_at);
    items.push({
      key: `s-${s.id}`,
      date: when.date,
      time: when.time,
      title: s.topic,
      kind: "session",
      sub: s.status === "confirmed" ? "Honic session (confirmed)" : "Honic session (waiting for confirmation)",
      done: false,
      tab: "sessions",
    });
  }
  for (const d of b.documents) {
    if (!d.due_date) continue;
    items.push({ key: `doc-${d.id}`, date: d.due_date, time: null, title: d.name, kind: "document", sub: "Document due", done: d.status === "approved", tab: "documents" });
  }
  if (b.workspace.defence_date) {
    items.push({ key: "defence", date: b.workspace.defence_date, time: null, title: "Final defence", kind: "defence", sub: "Defence day", done: false, tab: "defence" });
  }
  return items.sort((a, b2) => a.date.localeCompare(b2.date) || (a.time ?? "").localeCompare(b2.time ?? ""));
}
