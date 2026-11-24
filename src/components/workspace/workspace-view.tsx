import Link from "next/link";
import type { ReactNode } from "react";

import { ActivityList } from "@/components/workspace/sections/activity";
import { CalendarSection } from "@/components/workspace/sections/calendar";
import { DataSection } from "@/components/workspace/sections/data";
import { DefenceSection } from "@/components/workspace/sections/defence";
import { FieldStudySection } from "@/components/workspace/sections/field-study";
import { FilesSection } from "@/components/workspace/sections/files";
import { GanttSection } from "@/components/workspace/sections/gantt";
import { HomeSection } from "@/components/workspace/sections/home";
import { LogbookSection } from "@/components/workspace/sections/logbook";
import { MessagesSection } from "@/components/workspace/sections/messages";
import { ReviewSection } from "@/components/workspace/sections/review";
import { OverviewSection } from "@/components/workspace/sections/overview";
import { PartsSection } from "@/components/workspace/sections/parts";
import { PaymentsSection } from "@/components/workspace/sections/payments";
import { ReferencesSection } from "@/components/workspace/sections/references";
import { ReportsSection } from "@/components/workspace/sections/reports";
import { SessionsSection } from "@/components/workspace/sections/sessions";
import { TasksSection } from "@/components/workspace/sections/tasks";
import { TeamSection } from "@/components/workspace/sections/team";
import { WorkspaceLiveSync } from "@/components/workspace/workspace-live-sync";
import { WorkspaceProvider } from "@/components/workspace/ws-context";
import type { PortalPaymentRow } from "@/lib/portal/payments-ledger";
import type { PayoutAccount } from "@/lib/portal/payout-accounts";
import { todayIso } from "@/lib/workspace/dates";
import { tabHref } from "@/lib/workspace/links";
import { scheduleHealth } from "@/lib/workspace/schedule";
import type { Viewer, WorkspaceBundle } from "@/lib/workspace/types";

type TabDef = { key: string; label: string; group: string };

const BASE_TABS: TabDef[] = [
  { key: "home", label: "Home", group: "Overview" },
  { key: "project", label: "Project details", group: "Overview" },
  { key: "team", label: "Team & supervisor", group: "Overview" },
  { key: "gantt", label: "Gantt chart", group: "Plan" },
  { key: "tasks", label: "Task board", group: "Plan" },
  { key: "calendar", label: "Calendar", group: "Plan" },
  { key: "field", label: "Field study", group: "Plan" },
  { key: "review", label: "Review", group: "Work" },
  { key: "files", label: "Project files", group: "Work" },
  { key: "logbook", label: "Logbook", group: "Work" },
  { key: "data", label: "Data and results", group: "Work" },
  { key: "parts", label: "Parts and budget", group: "Work" },
  { key: "references", label: "References", group: "Work" },
  { key: "messages", label: "Help desk", group: "Honic" },
  { key: "sessions", label: "Sessions", group: "Honic" },
  { key: "payments", label: "Payments", group: "Honic" },
];

/** Supervisor sees student layout minus Honic billing, help desk, team invites, and payments. */
const SUPERVISOR_TABS = [
  "home",
  "project",
  "gantt",
  "tasks",
  "calendar",
  "field",
  "review",
  "files",
  "logbook",
  "data",
  "references",
];

export function workspaceTabs(extra: { progress?: boolean; title?: boolean; supervisor?: boolean }): TabDef[] {
  if (extra.supervisor) return BASE_TABS.filter((t) => SUPERVISOR_TABS.includes(t.key));
  const tabs = [...BASE_TABS];
  if (extra.progress) tabs.push({ key: "progress", label: "Honic progress", group: "Honic" });
  if (extra.title) tabs.push({ key: "title", label: "Selected title", group: "Title" });
  return tabs;
}

export function WorkspaceView({
  bundle,
  viewer,
  tab,
  basePath,
  printBase,
  exportBase,
  fileBase,
  supervisorToken,
  hideNav = false,
  extra = {},
}: {
  /** Download route prefix for files. */
  fileBase: string;
  supervisorToken?: string;
  bundle: WorkspaceBundle;
  viewer: Viewer;
  tab: string;
  basePath: string;
  /** Prefix for print pages, e.g. /portal/print or /students/<id>/print. */
  printBase: string;
  /** Prefix for CSV downloads, e.g. /api/portal/export or /api/workspace/<id>/export. */
  exportBase: string;
  /** When true, skip the built-in side nav (portal shell supplies it). */
  hideNav?: boolean;
  extra?: {
    progress?: ReactNode;
    title?: ReactNode;
    projects?: ReactNode;
    account?: ReactNode;
    paymentsLedger?: {
      payments: PortalPaymentRow[];
      registeredName: string;
      payoutEligible: boolean;
      payoutAccount: PayoutAccount | null;
    };
  };
}) {
  const today = todayIso();
  const tabs = workspaceTabs({ progress: Boolean(extra.progress), title: Boolean(extra.title), supervisor: viewer.kind === "supervisor" });
  const known = new Set([
    ...tabs.map((t) => t.key),
    "defence",
    "reports",
    "projects",
    "account",
    "field",
    "progress",
    "title",
  ]);
  const active = known.has(tab) ? tab : "home";
  const health = scheduleHealth(bundle.tasks, today);

  const unread =
    viewer.kind === "supervisor"
      ? 0
      : bundle.messages.filter((m) =>
          viewer.kind === "staff" ? m.author_kind !== "staff" && !m.staff_read_at : m.author_kind === "staff" && !m.student_read_at,
        ).length;
  const reviewOpen = bundle.documents.filter((d) => d.status === "submitted" || d.status === "changes").length;
  const counts: Record<string, number> = {
    tasks: health.overdue.length,
    messages: unread,
    review: reviewOpen,
    sessions: bundle.bookings.filter((b) => b.status === "requested").length,
    payments: bundle.invoices.filter((i) => i.status === "unpaid").length,
  };

  const groups = [...new Set(tabs.map((t) => t.group))];
  const ws = bundle.workspace;

  let content: ReactNode;
  switch (active) {
    case "project":
      content = <OverviewSection workspace={ws} />;
      break;
    case "team":
      content = <TeamSection bundle={bundle} />;
      break;
    case "activity":
      content = <ActivityList activity={bundle.activity} full />;
      break;
    case "gantt":
      content = <GanttSection bundle={bundle} today={today} printHref={`${printBase}/gantt`} />;
      break;
    case "tasks":
      content = <TasksSection bundle={bundle} today={today} />;
      break;
    case "calendar":
      content = <CalendarSection bundle={bundle} today={today} />;
      break;
    case "field":
      content = <FieldStudySection bundle={bundle} today={today} />;
      break;
    case "review":
    case "documents":
    case "corrections":
      content = <ReviewSection bundle={bundle} printHref={`${printBase}/corrections`} />;
      break;
    case "files":
      content = <FilesSection files={bundle.files} storageLimitBytes={bundle.storageLimitBytes} />;
      break;
    case "logbook":
      content = <LogbookSection entries={bundle.logbook} comments={bundle.comments} today={today} printHref={`${printBase}/logbook`} />;
      break;
    case "data":
      content = <DataSection datasets={bundle.datasets} />;
      break;
    case "parts":
      content = <PartsSection parts={bundle.parts} budget={ws.budget_tsh} />;
      break;
    case "references":
      content = <ReferencesSection references={bundle.references} />;
      break;
    case "messages":
      content = <MessagesSection messages={bundle.messages} />;
      break;
    case "sessions":
      content = <SessionsSection bookings={bundle.bookings} />;
      break;
    case "payments":
      content = (
        <PaymentsSection
          invoices={bundle.invoices}
          payments={extra.paymentsLedger?.payments ?? []}
          registeredName={extra.paymentsLedger?.registeredName ?? viewer.name}
          payoutEligible={Boolean(extra.paymentsLedger?.payoutEligible)}
          payoutAccount={extra.paymentsLedger?.payoutAccount ?? null}
        />
      );
      break;
    case "progress":
      content = extra.progress;
      break;
    case "defence":
      content = <DefenceSection items={bundle.defence} defenceDate={ws.defence_date} today={today} />;
      break;
    case "reports":
      content = <ReportsSection printBase={printBase} exportBase={exportBase} />;
      break;
    case "title":
      content = extra.title;
      break;
    case "projects":
      content = extra.projects ?? extra.title;
      break;
    case "account":
      content = extra.account;
      break;
    default:
      content = <HomeSection bundle={bundle} today={today} basePath={basePath} />;
  }

  // Staff Help desk is portal chat only — hide the full student workspace section nav.
  const staffHelpDesk = viewer.kind === "staff" && active === "messages";
  const showNav = !hideNav && !staffHelpDesk;

  return (
    <WorkspaceProvider value={{ workspaceId: ws.id, viewer, basePath, members: bundle.members, fileBase, supervisorToken }}>
      {/* Supervisor sees share / new marks without a manual refresh */}
      <WorkspaceLiveSync enabled={viewer.kind === "supervisor"} intervalMs={3500} />
      {showNav ? (
        <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-6">
          <nav aria-label="Workspace sections" className="mb-5 lg:mb-0">
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:sticky lg:top-24 lg:mx-0 lg:block lg:space-y-4 lg:overflow-visible lg:px-0">
              {groups.map((g) => (
                <div key={g} className="flex shrink-0 gap-1.5 lg:block">
                  <p className="text-dash-muted-foreground hidden px-3 pb-1 text-[10px] font-semibold tracking-widest uppercase lg:block">{g}</p>
                  {tabs
                    .filter((t) => t.group === g)
                    .map((t) => {
                      const on = t.key === active;
                      const n = counts[t.key] ?? 0;
                      return (
                        <Link
                          key={t.key}
                          href={tabHref(basePath, t.key)}
                          aria-current={on ? "page" : undefined}
                          className={`flex shrink-0 items-center justify-between gap-2 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors lg:rounded-lg lg:py-2 ${
                            on
                              ? "bg-dash-accent text-white lg:bg-dash-accent/15 lg:text-dash-foreground lg:ring-dash-accent/30 lg:ring-1"
                              : "border-dash-border bg-dash-card text-dash-muted-foreground hover:text-dash-foreground border lg:border-0 lg:bg-transparent lg:hover:bg-dash-muted"
                          }`}
                        >
                          {t.label}
                          {n > 0 ? (
                            <span
                              className={`min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold ${
                                t.key === "tasks" ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                              }`}
                            >
                              {n}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                </div>
              ))}
            </div>
          </nav>
          <div className="min-w-0 space-y-5">{content}</div>
        </div>
      ) : (
        <div className="min-w-0 space-y-5">
          {staffHelpDesk ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link href="/students/help-desk" className="text-dash-accent font-semibold">
                ← Help desk inbox
              </Link>
              <Link href={basePath} className="text-dash-muted-foreground hover:text-dash-foreground font-semibold">
                Open full workspace →
              </Link>
            </div>
          ) : null}
          {content}
        </div>
      )}
    </WorkspaceProvider>
  );
}
