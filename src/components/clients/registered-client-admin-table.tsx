"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteRegisteredClientFromManageAction,
  setRegisteredClientBlockedAction,
  setRegisteredClientHiddenAction,
} from "@/app/clients/actions";
import type { RegisteredClientRow } from "@/lib/dashboard-types";

type ActionState = {
  type: "ok" | "error";
  message: string;
} | null;

export function RegisteredClientAdminTable({ rows }: { rows: RegisteredClientRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionState>(null);
  const [isPending, startTransition] = useTransition();

  function runFor(id: string, action: () => Promise<void>) {
    setPendingId(id);
    setStatus(null);
    startTransition(async () => {
      try {
        await action();
        setStatus({ type: "ok", message: "Saved." });
      } catch (err) {
        setStatus({
          type: "error",
          message: err instanceof Error ? err.message : "Action failed.",
        });
      } finally {
        setPendingId(null);
        router.refresh();
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="border-dash-border bg-dash-card rounded-2xl border px-5 py-10 text-center">
        <p className="text-dash-muted-foreground text-sm">No registered clients found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {status ? (
        <p
          role="status"
          className={status.type === "ok" ? "text-emerald-600 dark:text-emerald-300 text-sm" : "text-red-600 dark:text-red-300 text-sm"}
        >
          {status.message}
        </p>
      ) : null}

      <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="divide-dash-border min-w-full divide-y text-sm">
            <thead className="bg-dash-muted/80">
              <tr className="text-dash-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Blocked reason</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-dash-border divide-y">
              {rows.map((row) => {
                const busy = isPending && pendingId === row.id;
                const hidden = Boolean(row.isHidden);
                const blocked = Boolean(row.isBlocked);
                return (
                  <tr key={row.id} className="hover:bg-dash-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-dash-foreground font-medium">{row.name}</p>
                      <p className="text-dash-muted-foreground mt-0.5 text-xs">{row.phone?.trim() || "No phone"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="border-dash-border bg-dash-muted/30 text-dash-muted-foreground inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                          {hidden ? "Hidden" : "Visible"}
                        </span>
                        <span
                          className={
                            blocked
                              ? "inline-flex rounded-full border border-amber-500/45 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200"
                              : "border-dash-border bg-dash-muted/30 text-dash-muted-foreground inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          }
                        >
                          {blocked ? "Blocked" : "Active"}
                        </span>
                      </div>
                    </td>
                    <td className="text-dash-muted-foreground px-4 py-3 text-xs">
                      {row.blockedReason?.trim() ? row.blockedReason.trim() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runFor(row.id, () => setRegisteredClientHiddenAction(row.id, !hidden))
                          }
                          className="border-dash-border bg-dash-muted hover:bg-dash-border rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                        >
                          {hidden ? "Unhide" : "Hide"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runFor(row.id, () =>
                              setRegisteredClientBlockedAction(
                                row.id,
                                !blocked,
                                !blocked ? "Blocked by admin on clients page." : null,
                              ),
                            )
                          }
                          className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                        >
                          {blocked ? "Unblock" : "Block"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(`Delete "${row.name}"? This only works if no tracked project uses it.`)) {
                              return;
                            }
                            runFor(row.id, () => deleteRegisteredClientFromManageAction(row.id));
                          }}
                          className="border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-300 rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
