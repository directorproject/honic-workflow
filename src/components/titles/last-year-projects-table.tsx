"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createTitleProposalAction, deleteLastYearProjectAction } from "@/app/titles/actions";
import { academicYearLabel, type AcademicYearSelection } from "@/lib/academic-year";
import type { LastYearProject } from "@/lib/title-bank";

type ActionState = { type: "ok" | "error"; message: string } | null;
type Tab = "all" | "ETE" | "COE";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ETE", label: "ETE Min Two" },
  { key: "COE", label: "COE Project Realization" },
];

const BTN =
  "border-dash-border bg-dash-muted hover:bg-dash-border rounded-lg border px-2.5 py-1 text-xs font-semibold whitespace-nowrap disabled:opacity-50";

function refLabel(p: LastYearProject) {
  if (p.programme === "ETE") return `ETE Panel ${p.panel ?? "?"} No. ${p.serialNo ?? "?"}`;
  return `COE No. ${p.serialNo ?? "?"}`;
}

export function LastYearProjectsTable({
  rows,
  selectedYear,
}: {
  rows: LastYearProject[];
  selectedYear: AcademicYearSelection;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [year, setYear] = useState<AcademicYearSelection>(selectedYear);
  const [query, setQuery] = useState("");
  const [showStudent, setShowStudent] = useState(true);
  const [showSupervisor, setShowSupervisor] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionState>(null);
  const [isPending, startTransition] = useTransition();

  const years = useMemo(() => {
    const found = new Set<number>();
    for (const row of rows) if (row.year != null) found.add(row.year);
    if (typeof selectedYear === "number") found.add(selectedYear);
    return [...found].sort((a, b) => b - a);
  }, [rows, selectedYear]);

  const inYear = useMemo(
    () => rows.filter((row) => year === "all" || row.year === year),
    [rows, year],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inYear.filter((r) => {
      if (tab !== "all" && r.programme !== tab) return false;
      if (!q) return true;
      return [r.title, r.studentName, r.regNo, r.supervisor, refLabel(r)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [inYear, tab, query]);

  const columnCount = 3 + (showStudent ? 1 : 0) + (showSupervisor ? 1 : 0);

  function run(id: string, action: () => Promise<void>, okMessage: string) {
    setPendingId(id);
    setStatus(null);
    startTransition(async () => {
      try {
        await action();
        setStatus({ type: "ok", message: okMessage });
      } catch (err) {
        setStatus({ type: "error", message: err instanceof Error ? err.message : "Action failed." });
      } finally {
        setPendingId(null);
        router.refresh();
      }
    });
  }

  function proposeFrom(r: LastYearProject) {
    const title = window.prompt(`New title based on:\n${r.title}`, "");
    if (title === null || !title.trim()) return;
    run(
      r.id,
      () => createTitleProposalAction({ title, originalTitle: r.title, originRef: refLabel(r) }),
      "New title added to the selection list.",
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-dash-muted-foreground flex items-center gap-2 text-xs font-semibold">
          Year
          <select
            value={year === "all" ? "all" : String(year)}
            onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="border-dash-border bg-dash-card text-dash-foreground rounded-full border px-3 py-1 text-xs font-semibold"
          >
            <option value="all">All years</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {academicYearLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-dash-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
          <input type="checkbox" checked={!showStudent} onChange={(e) => setShowStudent(!e.target.checked)} />
          Hide student
        </label>
        <label className="text-dash-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
          <input type="checkbox" checked={!showSupervisor} onChange={(e) => setShowSupervisor(!e.target.checked)} />
          Hide supervisor
        </label>
        {TABS.map((t) => {
          const count = t.key === "all" ? inYear.length : inYear.filter((r) => r.programme === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                tab === t.key
                  ? "bg-dash-accent rounded-full px-3 py-1 text-xs font-semibold text-white"
                  : "border-dash-border bg-dash-card text-dash-muted-foreground hover:bg-dash-muted rounded-full border px-3 py-1 text-xs font-semibold"
              }
            >
              {t.label} · {count}
            </button>
          );
        })}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, student, reg no., or supervisor"
          className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 ml-auto w-full max-w-xs rounded-xl border px-3 py-1.5 text-sm outline-none focus:ring-2"
        />
      </div>

      {status ? (
        <p
          role="status"
          className={status.type === "ok" ? "text-sm text-emerald-600 dark:text-emerald-300" : "text-sm text-red-600 dark:text-red-300"}
        >
          {status.message}
        </p>
      ) : null}

      <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="divide-dash-border min-w-full divide-y text-sm">
            <thead className="bg-dash-muted/80">
              <tr className="text-dash-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
                <th className="px-4 py-3">Ref</th>
                {showStudent ? <th className="px-4 py-3">Student</th> : null}
                <th className="px-4 py-3">Project title</th>
                {showSupervisor ? <th className="px-4 py-3">Supervisor</th> : null}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-dash-border divide-y">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="text-dash-muted-foreground px-4 py-8 text-center">
                    No projects match this year. Choose All years to see the full record.
                  </td>
                </tr>
              ) : (
                visible.map((r) => {
                  const busy = isPending && pendingId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-dash-muted/40 align-top transition-colors">
                      <td className="text-dash-muted-foreground px-4 py-3 text-xs whitespace-nowrap">{refLabel(r)}</td>
                      {showStudent ? (
                        <td className="px-4 py-3">
                          <p className="text-dash-foreground whitespace-nowrap">{r.studentName ?? "—"}</p>
                          <p className="text-dash-muted-foreground mt-0.5 text-xs tabular-nums">{r.regNo ?? ""}</p>
                        </td>
                      ) : null}
                      <td className="text-dash-foreground px-4 py-3 font-medium">{r.title}</td>
                      {showSupervisor ? (
                        <td className="text-dash-muted-foreground px-4 py-3 text-xs whitespace-nowrap">{r.supervisor ?? "—"}</td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={busy} onClick={() => proposeFrom(r)} className={BTN}>
                            New title
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Remove "${r.title}" from last year projects?`)) return;
                              run(r.id, () => deleteLastYearProjectAction(r.id), "Project removed.");
                            }}
                            className="rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
