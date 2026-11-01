"use client";

import { useState } from "react";

import { deleteItemAction, saveItemAction, updateWorkspaceAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_DANGER, BTN_GHOST, Empty, INPUT, Label, Modal, Panel, ProgressBar, Stat, Status } from "@/components/workspace/ws-ui";
import { formatTsh, PART_STATUSES, tone } from "@/lib/workspace/constants";
import type { Part } from "@/lib/workspace/types";

export function PartsSection({ parts, budget }: { parts: Part[]; budget: number | null }) {
  const { workspaceId, viewer } = useWs();
  const { run, status } = useRun();
  const [editing, setEditing] = useState<Partial<Part> | null>(null);
  const [budgetInput, setBudgetInput] = useState(String(budget ?? ""));
  const total = parts.reduce((s, p) => s + p.quantity * p.unit_price_tsh, 0);
  const spent = parts.filter((p) => p.status !== "needed").reduce((s, p) => s + p.quantity * p.unit_price_tsh, 0);
  const toBuy = parts.filter((p) => p.status === "needed").reduce((s, p) => s + p.quantity * p.unit_price_tsh, 0);
  const over = budget ? total > budget : false;

  function csv() {
    const rows = [["Item", "Quantity", "Unit price (TSh)", "Total (TSh)", "Status", "Supplier", "Link"], ...parts.map((p) => [p.name, p.quantity, p.unit_price_tsh, p.quantity * p.unit_price_tsh, p.status, p.supplier ?? "", p.link ?? ""])];
    const text = rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = "parts-and-budget.csv";
    a.click();
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Budget" value={budget ? formatTsh(budget) : "Not set"} />
        <Stat label="Planned cost" value={formatTsh(total)} tone={over ? "text-rose-600 dark:text-rose-300" : ""} hint={over ? `${formatTsh(total - (budget ?? 0))} over budget` : undefined} />
        <Stat label="Spent (ordered or bought)" value={formatTsh(spent)} />
        <Stat label="Still to buy" value={formatTsh(toBuy)} hint={`${parts.filter((p) => p.status === "needed").length} items`} />
      </div>

      <Panel
        title="Parts list"
        subtitle="Components and materials with quantity, price and status."
        actions={
          <>
            {parts.length ? (
              <button type="button" className={BTN_GHOST} onClick={csv}>
                Download CSV
              </button>
            ) : null}
            {viewer.canEdit ? (
              <button type="button" className={BTN} onClick={() => setEditing({ quantity: 1, unit_price_tsh: 0, status: "needed" })}>
                Add part
              </button>
            ) : null}
          </>
        }
      >
        {budget ? <ProgressBar value={(spent / budget) * 100} planned={(total / budget) * 100} className="mb-4" /> : null}
        <Status status={status} />
        {parts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-dash-muted-foreground text-left text-xs uppercase">
                <tr>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Unit price</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => {
                  const st = tone(PART_STATUSES, p.status);
                  return (
                    <tr key={p.id} className="border-dash-border border-t">
                      <td className="py-2 pr-3">
                        <p className="text-dash-foreground font-medium">
                          {p.link ? (
                            <a href={p.link} target="_blank" rel="noreferrer" className="hover:underline">
                              {p.name} ↗
                            </a>
                          ) : (
                            p.name
                          )}
                        </p>
                        {p.supplier || p.notes ? <p className="text-dash-muted-foreground text-xs">{[p.supplier, p.notes].filter(Boolean).join(" · ")}</p> : null}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.quantity}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatTsh(p.unit_price_tsh)}</td>
                      <td className="py-2 pr-3 text-right font-semibold tabular-nums">{formatTsh(p.quantity * p.unit_price_tsh)}</td>
                      <td className="py-2 pr-3">
                        {viewer.canEdit ? (
                          <select
                            aria-label="Status"
                            value={p.status}
                            onChange={(e) => run(() => saveItemAction(workspaceId, "part", p.id, { name: p.name, status: e.target.value }))}
                            className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${st.tone}`}
                          >
                            {PART_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.tone}`}>{st.label}</span>
                        )}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {viewer.canEdit ? (
                          <>
                            <button type="button" className={BTN_GHOST} onClick={() => setEditing(p)}>
                              Edit
                            </button>
                            <button type="button" className={BTN_DANGER} onClick={() => window.confirm(`Delete ${p.name}?`) && run(() => deleteItemAction(workspaceId, "part", p.id))}>
                              ✕
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-dash-border border-t-2">
                  <td colSpan={3} className="py-2 pr-3 text-right font-semibold">
                    Total
                  </td>
                  <td className="py-2 pr-3 text-right font-bold tabular-nums">{formatTsh(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <Empty title="No parts yet">List every component with its price to know your real budget before buying.</Empty>
        )}

        {viewer.canEdit ? (
          <form
            className="border-dash-border mt-5 flex flex-wrap items-end gap-2 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => updateWorkspaceAction(workspaceId, { budget_tsh: budgetInput }));
            }}
          >
            <Label text="Project budget (TSh)">
              <input type="number" min={0} step={1000} value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} className={`${INPUT} w-48`} />
            </Label>
            <button type="submit" className={BTN_GHOST}>
              Save budget
            </button>
          </form>
        ) : null}
      </Panel>
      <PartEditor part={editing} onClose={() => setEditing(null)} count={parts.length} />
    </>
  );
}

function PartEditor({ part, onClose, count }: { part: Partial<Part> | null; onClose: () => void; count: number }) {
  const { workspaceId } = useWs();
  const { run, pending, status } = useRun();
  if (!part) return null;
  return (
    <Modal open onClose={onClose} title={part.id ? "Edit part" : "Add part"}>
      <form
        key={part.id ?? "new"}
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const v: Record<string, unknown> = Object.fromEntries([...fd.entries()].map(([k, val]) => [k, String(val)]));
          if (!part.id) v.sort_order = count;
          run(() => saveItemAction(workspaceId, "part", part.id ?? null, v), { onOk: onClose });
        }}
      >
        <Label text="Item" wide>
          <input name="name" required maxLength={160} defaultValue={part.name ?? ""} placeholder="e.g. ESP32 DevKit V1" className={INPUT} autoFocus />
        </Label>
        <Label text="Quantity">
          <input name="quantity" type="number" min={0} step="any" defaultValue={part.quantity ?? 1} className={INPUT} />
        </Label>
        <Label text="Unit price (TSh)">
          <input name="unit_price_tsh" type="number" min={0} step={100} defaultValue={part.unit_price_tsh ?? 0} className={INPUT} />
        </Label>
        <Label text="Status">
          <select name="status" defaultValue={part.status ?? "needed"} className={INPUT}>
            {PART_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Supplier">
          <input name="supplier" maxLength={120} defaultValue={part.supplier ?? ""} placeholder="e.g. Honic shop, Kariakoo" className={INPUT} />
        </Label>
        <Label text="Link" wide>
          <input name="link" maxLength={500} defaultValue={part.link ?? ""} placeholder="https://" className={INPUT} />
        </Label>
        <Label text="Notes" wide>
          <input name="notes" maxLength={1000} defaultValue={part.notes ?? ""} className={INPUT} />
        </Label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button type="submit" disabled={pending} className={BTN}>
            {pending ? "Saving…" : "Save"}
          </button>
          <Status status={status} />
        </div>
      </form>
    </Modal>
  );
}
