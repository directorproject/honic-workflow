"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { INPUT } from "@/components/workspace/ws-ui";
import type { FinanceMovement } from "@/lib/staff/finance-ledger";

function formatTsh(n: number): string {
  return `TSh ${n.toLocaleString("en-US")}`;
}

function statusClass(status: string): string {
  if (status === "paid") return "text-emerald-700 dark:text-emerald-300";
  if (status === "pending" || status === "unpaid") return "text-amber-700 dark:text-amber-300";
  return "text-rose-700 dark:text-rose-300";
}

export function FinanceLedgerTable({ rows }: { rows: FinanceMovement[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (channel && row.channel !== channel) return false;
      if (!needle) return true;
      const hay = `${row.userLabel} ${row.reference} ${row.purpose} ${row.workspaceName ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, query, status, channel]);

  return (
    <div>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search user, reference, purpose…"
          className={INPUT}
          aria-label="Search movements"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT} aria-label="Status">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="unpaid">Unpaid</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={INPUT} aria-label="Channel">
          <option value="">Portal + workspace</option>
          <option value="portal">Portal (Snippe / mobile money)</option>
          <option value="workspace">Workspace invoices</option>
        </select>
      </div>

      <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-dash-muted/80 text-dash-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User / workspace</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Channel</th>
              </tr>
            </thead>
            <tbody className="divide-dash-border divide-y">
              {list.map((row) => (
                <tr key={row.id} className="hover:bg-dash-muted/40">
                  <td className="text-dash-foreground px-4 py-3 whitespace-nowrap">{row.when}</td>
                  <td className="px-4 py-3">
                    {row.userPublicId ? (
                      <Link href={`/users/${row.userPublicId}`} className="text-dash-accent font-semibold">
                        {row.userLabel}
                      </Link>
                    ) : row.workspaceId ? (
                      <Link href={`/students/${row.workspaceId}`} className="text-dash-accent font-semibold">
                        {row.workspaceName ?? row.userLabel}
                      </Link>
                    ) : (
                      <span className="text-dash-foreground">{row.userLabel}</span>
                    )}
                  </td>
                  <td className="text-dash-foreground px-4 py-3">{row.purpose}</td>
                  <td className="text-dash-foreground px-4 py-3 font-medium tabular-nums">{formatTsh(row.amountTsh)}</td>
                  <td className={`px-4 py-3 font-semibold capitalize ${statusClass(row.status)}`}>{row.status}</td>
                  <td className="text-dash-muted-foreground max-w-[12rem] truncate px-4 py-3 font-mono text-xs" title={row.reference}>
                    {row.reference}
                  </td>
                  <td className="text-dash-muted-foreground px-4 py-3 text-xs">
                    {row.channel === "portal" ? row.provider ?? "portal" : "invoice"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 ? (
          <p className="text-dash-muted-foreground px-4 py-8 text-center text-sm">No movements match this filter.</p>
        ) : (
          <p className="text-dash-muted-foreground border-dash-border border-t px-4 py-2 text-xs">
            Showing {list.length} of {rows.length}
          </p>
        )}
      </div>
    </div>
  );
}