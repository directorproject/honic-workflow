"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, Empty, INPUT, ProgressBar } from "@/components/workspace/ws-ui";
import { projectCategoryLabel, PROJECT_CATEGORIES } from "@/lib/portal/config";
import { formatDate } from "@/lib/workspace/dates";
import type { WorkspaceSummary } from "@/lib/workspace/load";

export type SummaryRow = WorkspaceSummary & { risk: string[] };

export function StudentsTable({ rows }: { rows: SummaryRow[] }) {
  const [q, setQ] = useState("");
  const [inst, setInst] = useState("");
  const [course, setCourse] = useState("");
  const [cat, setCat] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const institutions = useMemo(() => [...new Set(rows.flatMap((r) => r.members.map((m) => m.institution).filter((x): x is string => Boolean(x))))].sort(), [rows]);
  const courses = useMemo(() => [...new Set(rows.flatMap((r) => r.members.map((m) => m.courseCode).filter((x): x is string => Boolean(x))))].sort(), [rows]);

  const list = rows.filter(
    (r) =>
      (!q || `${r.name} ${r.members.map((m) => m.name).join(" ")}`.toLowerCase().includes(q.toLowerCase())) &&
      (!inst || r.members.some((m) => m.institution === inst)) &&
      (!course || r.members.some((m) => m.courseCode === course)) &&
      (!cat || r.category === cat) &&
      (!riskOnly || r.risk.length > 0),
  );

  return (
    <div>
      <div className="mb-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project or student" className={`${INPUT} lg:col-span-2`} />
        <select value={inst} onChange={(e) => setInst(e.target.value)} className={INPUT} aria-label="Institution">
          <option value="">All institutions</option>
          {institutions.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <select value={course} onChange={(e) => setCourse(e.target.value)} className={INPUT} aria-label="Course">
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={INPUT} aria-label="Project type">
          <option value="">All project types</option>
          {PROJECT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={riskOnly} onChange={(e) => setRiskOnly(e.target.checked)} />
        Only students at risk (behind plan, many late tasks or inactive for 14 days)
      </label>

      {list.length ? (
        <div className="border-dash-border bg-dash-card overflow-x-auto rounded-2xl border shadow-sm">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-dash-muted-foreground bg-dash-muted/50 text-left text-xs uppercase">
              <tr>
                <th className="px-3 py-2">Project and team</th>
                <th className="px-3 py-2">Progress</th>
                <th className="px-3 py-2">Late</th>
                <th className="px-3 py-2">Last active</th>
                <th className="px-3 py-2">Needs Honic</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-dash-border hover:bg-dash-muted/40 border-t">
                  <td className="px-3 py-2.5">
                    <Link href={`/students/${r.id}`} className="text-dash-foreground font-semibold hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-dash-muted-foreground text-xs">
                      {r.members.map((m, i) => (
                        <Link
                          key={i}
                          href={`/students/${r.id}`}
                          className="text-dash-accent hover:underline"
                        >
                          {m.name}
                        </Link>
                      )).reduce((acc, el, idx, arr) => (idx === arr.length - 1 ? [...acc, el] : [...acc, el, ", "]), [] as any[])}
                      {r.members[0]?.institution ? ` · ${r.members[0].institution}` : ""}
                      {r.members[0]?.courseCode ? ` · ${r.members[0].courseCode}` : ""}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.category ? <Badge className="bg-dash-accent/15 text-dash-accent">{projectCategoryLabel(r.category)}</Badge> : null}
                      {r.risk.map((x) => (
                        <Badge key={x} className="bg-rose-500/15 text-rose-700 dark:text-rose-300">
                          {x}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="w-40 px-3 py-2.5">
                    <ProgressBar value={r.health.actual} planned={r.health.planned} />
                    <p className="text-dash-muted-foreground mt-0.5 text-xs tabular-nums">
                      {r.health.actual}% · {r.health.planned}%
                    </p>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-sm">{r.health.overdue.length || "—"}</td>
                  <td className="text-dash-muted-foreground px-3 py-2.5 text-xs">{formatDate(r.lastActivityAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.unreadMessages ? (
                        <Link href={`/students/help-desk?c=${encodeURIComponent(r.id)}`} className="inline-flex">
                          <Badge className="bg-rose-500 text-white hover:opacity-90">
                            {r.unreadMessages} msg
                          </Badge>
                        </Link>
                      ) : null}
                      {r.pendingBookings ? <Badge className="bg-amber-500 text-white">{r.pendingBookings} session</Badge> : null}
                      {r.unpaidInvoices ? <Badge className="bg-slate-500/20 text-dash-muted-foreground">{r.unpaidInvoices} unpaid</Badge> : null}
                      {!r.unreadMessages && !r.pendingBookings && !r.unpaidInvoices ? <span className="text-dash-muted-foreground text-xs">—</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/students/${r.id}`}
                      className="inline-flex items-center rounded-lg bg-dash-accent/10 px-2.5 py-1 text-xs font-semibold text-dash-accent hover:bg-dash-accent/20"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={rows.length ? "No workspaces match" : "No student workspaces yet"}>
          Students create a workspace on share.honiccompany.com/portal after choosing their title.
        </Empty>
      )}
    </div>
  );
}
