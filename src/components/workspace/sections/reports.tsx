import { Panel } from "@/components/workspace/ws-ui";

const PRINTS = [
  { path: "progress?period=week", name: "Weekly progress report", note: "Tasks finished and planned, logbook, problems and next steps for the last 7 days." },
  { path: "progress?period=month", name: "Monthly progress report", note: "The same for the last 30 days, with phase progress." },
  { path: "plan", name: "Project plan with Gantt chart", note: "Overview, objectives, phases and a printable Gantt chart for the department." },
  { path: "logbook", name: "Logbook", note: "All entries with signature lines for the supervisor." },
];

const EXPORTS = [
  { kind: "tasks", name: "Tasks and schedule (CSV)", note: "Opens in Excel: phases, dates, status, progress." },
  { kind: "logbook", name: "Logbook (CSV)", note: "Date, hours, work done, problems, next steps." },
  { kind: "parts", name: "Parts and budget (CSV)", note: "Items, quantities and prices." },
  { kind: "references", name: "References (text)", note: "IEEE style list to paste into the report." },
];

export function ReportsSection({ printBase, exportBase }: { printBase: string; exportBase: string }) {
  return (
    <>
      <Panel title="Reports" subtitle="Open a report, then use Print and choose Save as PDF.">
        <div className="grid gap-3 sm:grid-cols-2">
          {PRINTS.map((p) => (
            <a key={p.path} href={`${printBase}/${p.path}`} target="_blank" rel="noreferrer" className="border-dash-border hover:border-dash-accent/50 hover:bg-dash-muted/40 rounded-xl border p-4">
              <p className="text-dash-foreground text-sm font-semibold">{p.name} ↗</p>
              <p className="text-dash-muted-foreground mt-0.5 text-xs">{p.note}</p>
            </a>
          ))}
        </div>
      </Panel>
      <Panel title="Export data">
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPORTS.map((e) => (
            <a key={e.kind} href={`${exportBase}/${e.kind}`} className="border-dash-border hover:border-dash-accent/50 hover:bg-dash-muted/40 rounded-xl border p-4">
              <p className="text-dash-foreground text-sm font-semibold">{e.name} ↓</p>
              <p className="text-dash-muted-foreground mt-0.5 text-xs">{e.note}</p>
            </a>
          ))}
        </div>
      </Panel>
    </>
  );
}
