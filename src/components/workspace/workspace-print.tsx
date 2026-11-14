import type { ReactNode } from "react";

import { AppendixGanttTable } from "@/components/workspace/appendix-gantt";
import { GanttChart } from "@/components/workspace/gantt-chart";
import { PrintButton } from "@/components/workspace/print-button";
import { WorkspaceProvider } from "@/components/workspace/ws-context";
import { projectCategoryLabel } from "@/lib/portal/config";
import { DOCUMENT_STATUSES, formatTsh, labelOf, TASK_STATUSES } from "@/lib/workspace/constants";
import { addDays, formatDate, todayIso } from "@/lib/workspace/dates";
import { scheduleHealth } from "@/lib/workspace/schedule";
import type { WorkspaceBundle } from "@/lib/workspace/types";

export type PrintKind = "progress" | "plan" | "logbook" | "corrections" | "gantt";

export const PRINT_KINDS: PrintKind[] = ["progress", "plan", "logbook", "corrections", "gantt"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-base font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Para({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="mb-3">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="text-sm whitespace-pre-wrap text-slate-800">{text}</p>
    </div>
  );
}

const TH = "border border-slate-300 bg-slate-100 px-2 py-1 text-left text-xs font-semibold text-slate-700";
const TD = "border border-slate-300 px-2 py-1 align-top text-xs text-slate-800";

export function WorkspacePrint({ bundle, kind, period }: { bundle: WorkspaceBundle; kind: PrintKind; period: "week" | "month" }) {
  const ws = bundle.workspace;
  const today = todayIso();
  const health = scheduleHealth(bundle.tasks, today);
  const titles: Record<PrintKind, string> = {
    progress: period === "week" ? "Weekly progress report" : "Monthly progress report",
    plan: "Project plan",
    logbook: "Project logbook",
    corrections: "Supervisor correction summary",
    gantt: "Gantt chart (appendix)",
  };
  const from = addDays(today, period === "week" ? -6 : -29);
  const phaseName = (id: string | null) => bundle.phases.find((p) => p.id === id)?.name ?? "Other";

  let body: ReactNode = null;
  if (kind === "progress") {
    const done = bundle.tasks.filter((t) => t.status === "done" && t.completed_at && t.completed_at.slice(0, 10) >= from);
    const doing = bundle.tasks.filter((t) => t.status === "doing");
    const next = bundle.tasks
      .filter((t) => t.status !== "done" && t.due_date && t.due_date >= today && t.due_date <= addDays(today, period === "week" ? 7 : 30))
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    const logs = bundle.logbook.filter((l) => l.entry_date >= from).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const problems = logs.map((l) => l.problems).filter(Boolean);
    const spent = bundle.parts.filter((p) => p.status !== "needed").reduce((s, p) => s + p.quantity * p.unit_price_tsh, 0);
    body = (
      <>
        <p className="mt-2 text-sm text-slate-700">
          Period: {formatDate(from)} to {formatDate(today)}
        </p>
        <Section title="Summary">
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className={TH}>Overall progress</td>
                <td className={TD}>
                  {health.actual}% done (plan: {health.planned}% by today)
                </td>
                <td className={TH}>Tasks</td>
                <td className={TD}>
                  {health.doneCount} of {health.total} done, {health.overdue.length} late
                </td>
              </tr>
              <tr>
                <td className={TH}>Logbook</td>
                <td className={TD}>
                  {logs.length} entries, {logs.reduce((s, l) => s + Number(l.hours ?? 0), 0)} hours
                </td>
                <td className={TH}>Spent on parts</td>
                <td className={TD}>
                  {formatTsh(spent)}
                  {ws.budget_tsh ? ` of ${formatTsh(ws.budget_tsh)}` : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
        <Section title="Progress by phase">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Phase</th>
                <th className={TH}>Tasks done</th>
                <th className={TH}>Dates</th>
              </tr>
            </thead>
            <tbody>
              {bundle.phases.map((p) => {
                const list = bundle.tasks.filter((t) => t.phase_id === p.id);
                const starts = list.map((t) => t.start_date).filter(Boolean).sort();
                const dues = list.map((t) => t.due_date).filter(Boolean).sort();
                return (
                  <tr key={p.id}>
                    <td className={TD}>{p.name}</td>
                    <td className={TD}>
                      {list.filter((t) => t.status === "done").length} / {list.length}
                    </td>
                    <td className={TD}>
                      {formatDate(starts[0])} – {formatDate(dues[dues.length - 1])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
        <Section title="Completed in this period">
          {done.length ? (
            <ul className="list-disc pl-5 text-sm text-slate-800">
              {done.map((t) => (
                <li key={t.id}>
                  {t.title} <span className="text-slate-500">({phaseName(t.phase_id)}, {formatDate(t.completed_at)})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No tasks were completed in this period.</p>
          )}
        </Section>
        <Section title="In progress">
          {doing.length ? (
            <ul className="list-disc pl-5 text-sm text-slate-800">
              {doing.map((t) => (
                <li key={t.id}>
                  {t.title} – {t.progress}% <span className="text-slate-500">(due {formatDate(t.due_date)})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">Nothing in progress.</p>
          )}
        </Section>
        {health.overdue.length ? (
          <Section title="Late tasks">
            <ul className="list-disc pl-5 text-sm text-slate-800">
              {health.overdue.map((t) => (
                <li key={t.id}>
                  {t.title} <span className="text-slate-500">(was due {formatDate(t.due_date)})</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        {problems.length ? (
          <Section title="Problems met">
            <ul className="list-disc pl-5 text-sm text-slate-800">
              {problems.map((p, i) => (
                <li key={i} className="whitespace-pre-wrap">
                  {p}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        <Section title={period === "week" ? "Plan for next week" : "Plan for next month"}>
          {next.length ? (
            <ul className="list-disc pl-5 text-sm text-slate-800">
              {next.map((t) => (
                <li key={t.id}>
                  {t.title} <span className="text-slate-500">(due {formatDate(t.due_date)})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No tasks are due in the next period.</p>
          )}
        </Section>
        <Section title="Documents">
          <table className="w-full border-collapse">
            <tbody>
              {bundle.documents.map((d) => (
                <tr key={d.id}>
                  <td className={TD}>{d.name}</td>
                  <td className={TD}>{labelOf(DOCUMENT_STATUSES, d.status)}</td>
                  <td className={TD}>{d.due_date ? `Due ${formatDate(d.due_date)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Signatures />
      </>
    );
  } else if (kind === "plan") {
    body = (
      <>
        <Section title="Project details">
          {![ws.problem_statement, ws.objectives, ws.scope, ws.methodology, ws.expected_results, ws.technologies].some(Boolean) ? (
            <p className="text-sm text-slate-500">Not filled in yet. Add them on the Project details page of the portal.</p>
          ) : null}
          <Para label="Problem statement" text={ws.problem_statement} />
          <Para label="Objectives" text={ws.objectives} />
          <Para label="Scope" text={ws.scope} />
          <Para label="Methodology" text={ws.methodology} />
          <Para label="Expected results" text={ws.expected_results} />
          <Para label="Main components and technologies" text={ws.technologies} />
        </Section>
        <Section title="Gantt chart">
          <WorkspaceProvider
            value={{ workspaceId: ws.id, viewer: { kind: "supervisor", userId: null, name: "", canEdit: false }, basePath: "", members: bundle.members, fileBase: "" }}
          >
            <GanttChart workspace={ws} phases={bundle.phases} tasks={bundle.tasks} zoom="month" today={today} printMode />
          </WorkspaceProvider>
        </Section>
        <Section title="Work plan">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Phase</th>
                <th className={TH}>Task</th>
                <th className={TH}>Start</th>
                <th className={TH}>Due</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {bundle.tasks.map((t) => (
                <tr key={t.id}>
                  <td className={TD}>{phaseName(t.phase_id)}</td>
                  <td className={TD}>
                    {t.title}
                    {t.is_milestone ? " (milestone)" : ""}
                  </td>
                  <td className={TD}>{formatDate(t.start_date)}</td>
                  <td className={TD}>{formatDate(t.due_date)}</td>
                  <td className={TD}>{labelOf(TASK_STATUSES, t.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        {bundle.parts.length ? (
          <Section title="Budget">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>Item</th>
                  <th className={TH}>Qty</th>
                  <th className={TH}>Unit price</th>
                  <th className={TH}>Total</th>
                </tr>
              </thead>
              <tbody>
                {bundle.parts.map((p) => (
                  <tr key={p.id}>
                    <td className={TD}>{p.name}</td>
                    <td className={TD}>{p.quantity}</td>
                    <td className={TD}>{formatTsh(p.unit_price_tsh)}</td>
                    <td className={TD}>{formatTsh(p.quantity * p.unit_price_tsh)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={TH} colSpan={3}>
                    Total
                  </td>
                  <td className={TH}>{formatTsh(bundle.parts.reduce((s, p) => s + p.quantity * p.unit_price_tsh, 0))}</td>
                </tr>
              </tbody>
            </table>
          </Section>
        ) : null}
      </>
    );
  } else if (kind === "gantt") {
    body = (
      <div className="mt-6">
        <AppendixGanttTable
          workspace={ws}
          phases={bundle.phases}
          tasks={bundle.tasks}
          appendixLabel="Appendix: B Gantt Chart"
        />
        <p className="mt-4 text-xs text-slate-500 print:text-slate-600">
          Coloured months show when each task runs. Export via Print → Save as PDF for your report appendix.
        </p>
      </div>
    );
  } else if (kind === "corrections") {
    const docs = bundle.documents.filter((d) => d.status !== "not_started" || bundle.files.some((f) => f.document_id === d.id));
    body = (
      <>
        <p className="mt-2 text-sm text-slate-700">
          Take this sheet to your supervisor. Do not reprint the full report unless they ask. Feedback stays in the portal.
        </p>
        <Section title="Chapters">
          {docs.length === 0 ? (
            <p className="text-sm text-slate-500">No chapters in the correction loop yet.</p>
          ) : (
            docs.map((d) => {
              const comments = bundle.comments.filter((c) => c.target_type === "document" && c.target_id === d.id);
              const latest = bundle.files.find((f) => f.document_id === d.id);
              return (
                <div key={d.id} className="mb-5 break-inside-avoid">
                  <p className="text-sm font-bold text-slate-900">
                    {d.name}{" "}
                    <span className="font-normal text-slate-600">({labelOf(DOCUMENT_STATUSES, d.status)})</span>
                  </p>
                  {latest ? (
                    <p className="mt-1 text-xs text-slate-600">
                      Latest file: {latest.name} · {formatDate(latest.created_at.slice(0, 10))}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">No file uploaded yet.</p>
                  )}
                  <Para label="What changed since last feedback" text={d.change_summary} />
                  {comments.length ? (
                    <div className="mt-2">
                      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Open comments</p>
                      <ul className="mt-1 space-y-1">
                        {comments.slice(-8).map((c) => (
                          <li key={c.id} className="text-xs text-slate-800">
                            <span className="font-semibold">{c.author_name}</span>
                            {c.author_kind === "supervisor" ? " (supervisor)" : c.author_kind === "staff" ? " (Honic)" : ""}
                            : {c.body}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No comments yet.</p>
                  )}
                </div>
              );
            })
          )}
        </Section>
        <Section title="Meeting asks">
          <p className="text-sm text-slate-700">Decisions needed today:</p>
          <div className="mt-3 h-24 border border-dashed border-slate-400" />
        </Section>
        <Signatures />
      </>
    );
  } else {
    const logs = [...bundle.logbook].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    body = (
      <Section title={`${logs.length} ${logs.length === 1 ? "entry" : "entries"}, ${logs.reduce((s, l) => s + Number(l.hours ?? 0), 0)} hours`}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>Date</th>
              <th className={TH}>Hours</th>
              <th className={TH}>Work done</th>
              <th className={TH}>Problems</th>
              <th className={TH}>Next steps</th>
              <th className={TH}>Supervisor initials</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="break-inside-avoid">
                <td className={`${TD} whitespace-nowrap`}>{formatDate(l.entry_date)}</td>
                <td className={TD}>{l.hours ?? ""}</td>
                <td className={`${TD} whitespace-pre-wrap`}>{l.work_done}</td>
                <td className={`${TD} whitespace-pre-wrap`}>{l.problems ?? ""}</td>
                <td className={`${TD} whitespace-pre-wrap`}>{l.next_steps ?? ""}</td>
                <td className={`${TD} w-24`} />
              </tr>
            ))}
          </tbody>
        </table>
        <Signatures />
      </Section>
    );
  }

  const landscape = kind === "plan" || kind === "gantt";

  return (
    <main
      className={`ws-print mx-auto bg-white px-8 py-8 text-slate-900 print:max-w-none print:px-0 print:py-0 ${
        landscape ? "max-w-[297mm]" : "max-w-[210mm]"
      }`}
    >
      <style>{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 14mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="mb-4 flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-slate-500">Check the preview, then print or choose Save as PDF.</p>
        <PrintButton />
      </div>
      {kind === "gantt" ? (
        <>
          <header className="mb-4 border-b border-slate-300 pb-2 print:hidden">
            <p className="text-xs font-semibold tracking-widest text-sky-800 uppercase">Honic student portal</p>
            <h1 className="text-lg font-bold">{titles.gantt}</h1>
            <p className="text-sm text-slate-600">{ws.name}</p>
          </header>
          {body}
        </>
      ) : (
        <>
          <header className="flex items-center gap-4 border-b-2 border-sky-700 pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Honic" className="h-12 w-auto" />
            <div>
              <p className="text-xs font-semibold tracking-widest text-sky-800 uppercase">Honic Company Limited · Innovation and Research</p>
              <h1 className="text-xl font-bold">{titles[kind]}</h1>
            </div>
          </header>
          <table className="mt-4 w-full border-collapse">
            <tbody>
              <tr>
                <td className={TH}>Project</td>
                <td className={TD} colSpan={3}>
                  {ws.name}
                </td>
              </tr>
              <tr>
                <td className={TH}>Students</td>
                <td className={TD}>{bundle.members.map((m) => m.full_name).join(", ")}</td>
                <td className={TH}>Institution</td>
                <td className={TD}>{[...new Set(bundle.members.map((m) => m.institution).filter(Boolean))].join(", ")}</td>
              </tr>
              <tr>
                <td className={TH}>Type</td>
                <td className={TD}>{projectCategoryLabel(ws.project_category) ?? ""}</td>
                <td className={TH}>Supervisor</td>
                <td className={TD}>{ws.supervisor_name ?? ""}</td>
              </tr>
              <tr>
                <td className={TH}>Dates</td>
                <td className={TD}>
                  {formatDate(ws.start_date)} – {formatDate(ws.end_date)}
                </td>
                <td className={TH}>Defence</td>
                <td className={TD}>{formatDate(ws.defence_date)}</td>
              </tr>
            </tbody>
          </table>
          {body}
          <p className="mt-8 text-[10px] text-slate-400">Generated {formatDate(today)} from the Honic student portal.</p>
        </>
      )}
    </main>
  );
}

function Signatures() {
  return (
    <div className="mt-10 grid grid-cols-2 gap-10 text-sm break-inside-avoid">
      {["Student", "Supervisor"].map((r) => (
        <div key={r}>
          <div className="h-10 border-b border-slate-400" />
          <p className="mt-1 text-slate-600">
            {r} signature and date
          </p>
        </div>
      ))}
    </div>
  );
}
