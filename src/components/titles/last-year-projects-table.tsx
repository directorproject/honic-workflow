"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { createTitleProposalAction, deleteLastYearProjectAction } from "@/app/titles/actions";
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

export function LastYearProjectsTable({ rows }: { rows: LastYearProject[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionState>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.programme !== tab) return false;
      if (!q) return true;
      return [r.title, r.studentName, r.regNo, r.supervisor, refLabel(r)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, tab, query]);

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
        {TABS.map((t) => {
          const count = t.key === "all" ? rows.length : rows.filter((r) => r.programme === t.key).length;
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
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Project title</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-dash-border divide-y">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-dash-muted-foreground px-4 py-8 text-center">
                    No projects match.
                  </td>
                </tr>
              ) : (
                visible.map((r) => {
                  const busy = isPending && pendingId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-dash-muted/40 align-top transition-colors">
                      <td className="text-dash-muted-foreground px-4 py-3 text-xs whitespace-nowrap">{refLabel(r)}</td>
                      <td className="px-4 py-3">
                        <p className="text-dash-foreground whitespace-nowrap">{r.studentName ?? "—"}</p>
                        <p className="text-dash-muted-foreground mt-0.5 text-xs tabular-nums">{r.regNo ?? ""}</p>
                      </td>
                      <td className="text-dash-foreground px-4 py-3 font-medium">{r.title}</td>
                      <td className="text-dash-muted-foreground px-4 py-3 text-xs whitespace-nowrap">{r.supervisor ?? "—"}</td>
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
