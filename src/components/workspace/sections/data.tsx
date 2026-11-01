"use client";

import { useMemo, useRef, useState } from "react";

import { deleteItemAction, saveItemAction } from "@/app/portal/workspace-actions";
import { LineChart } from "@/components/workspace/line-chart";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_DANGER, BTN_GHOST, BTN_SOFT, Empty, INPUT, Label, Modal, Panel, Status } from "@/components/workspace/ws-ui";
import { formatDateTime } from "@/lib/workspace/dates";
import type { Dataset } from "@/lib/workspace/types";

type Cell = string | number | null;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : text.includes("\t") ? "\t" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

function toCell(s: string): Cell {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : t;
}

function csvOf(d: Dataset): string {
  const esc = (v: Cell) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [d.columns.map(esc).join(","), ...d.rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function DataSection({ datasets }: { datasets: Dataset[] }) {
  const { workspaceId, viewer } = useWs();
  const [selectedId, setSelectedId] = useState(datasets[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const selected = datasets.find((d) => d.id === selectedId) ?? datasets[0];

  return (
    <>
      <Panel
        title="Data and results"
        subtitle="Record measurements or upload a CSV file (for example sensor readings) and see them as a chart for your results chapter."
        actions={
          viewer.canEdit ? (
            <button type="button" className={BTN} onClick={() => setCreating(true)}>
              New data set
            </button>
          ) : null
        }
      >
        {datasets.length ? (
          <div className="flex flex-wrap gap-1.5">
            {datasets.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${selected?.id === d.id ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground hover:text-dash-foreground"}`}
              >
                {d.name} ({d.rows.length})
              </button>
            ))}
          </div>
        ) : (
          <Empty title="No data yet">Create a data set with your column names, then add rows or paste a CSV file.</Empty>
        )}
      </Panel>
      {selected ? <DatasetView key={selected.id} dataset={selected} workspaceId={workspaceId} canEdit={viewer.canEdit} /> : null}
      <CreateDataset open={creating} onClose={() => setCreating(false)} onCreated={(id) => setSelectedId(id)} />
    </>
  );
}

function CreateDataset({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { workspaceId } = useWs();
  const { run, pending, status } = useRun();
  const [name, setName] = useState("");
  const [cols, setCols] = useState("Time (s), Temperature (°C)");
  const [csv, setCsv] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function create() {
    let columns = cols.split(",").map((c) => c.trim()).filter(Boolean);
    let rows: Cell[][] = [];
    if (csv.trim()) {
      const parsed = parseCsv(csv);
      columns = parsed[0].map((c) => c.trim() || "Column");
      rows = parsed.slice(1).map((r) => columns.map((_, i) => toCell(r[i] ?? "")));
    }
    if (!columns.length) columns = ["X", "Y"];
    run(() => saveItemAction(workspaceId, "dataset", null, { name, columns, rows }), {
      onOk: (d) => {
        if (d?.id) onCreated(d.id);
        setName("");
        setCsv("");
        onClose();
      },
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="New data set">
      <div className="grid gap-3">
        <Label text="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Battery discharge test 1" maxLength={120} className={INPUT} />
        </Label>
        <Label text="Columns (comma separated; the first column is the x axis)">
          <input value={cols} onChange={(e) => setCols(e.target.value)} className={INPUT} disabled={Boolean(csv.trim())} />
        </Label>
        <Label text="Or paste CSV (first row = column names)">
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} placeholder={"time,voltage\n0,4.2\n10,4.1"} className={`${INPUT} font-mono text-xs`} />
        </Label>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setCsv(await f.text());
              if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
          <button type="button" className={BTN_SOFT} onClick={() => fileRef.current?.click()}>
            Choose a CSV file
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending || !name.trim()} className={BTN} onClick={create}>
            {pending ? "Creating…" : "Create"}
          </button>
          <Status status={status} />
        </div>
      </div>
    </Modal>
  );
}

function DatasetView({ dataset: d, workspaceId, canEdit }: { dataset: Dataset; workspaceId: string; canEdit: boolean }) {
  const { run, pending, status } = useRun();
  const [newRow, setNewRow] = useState<string[]>(d.columns.map(() => ""));
  const [hidden, setHidden] = useState<string[]>([]);
  const numericCols = useMemo(
    () => d.columns.map((_, ci) => ci).filter((ci) => ci > 0 && d.rows.some((r) => typeof r[ci] === "number")),
    [d],
  );
  const series = numericCols
    .filter((ci) => !hidden.includes(d.columns[ci]))
    .map((ci) => ({ name: d.columns[ci], values: d.rows.map((r) => (typeof r[ci] === "number" ? (r[ci] as number) : null)) }));
  const xs = d.rows.map((r, i) => (r[0] === null || r[0] === undefined ? i + 1 : (r[0] as number | string)));
  const stats = numericCols.map((ci) => {
    const vals = d.rows.map((r) => r[ci]).filter((v): v is number => typeof v === "number");
    const avg = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
    return { name: d.columns[ci], min: Math.min(...vals), max: Math.max(...vals), avg };
  });

  function saveRows(rows: Cell[][]) {
    run(() => saveItemAction(workspaceId, "dataset", d.id, { rows }, { quiet: true }));
  }

  function download() {
    const blob = new Blob([csvOf(d)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${d.name.replace(/[^\w-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <Panel
        title={d.name}
        subtitle={`${d.rows.length} rows · updated ${formatDateTime(d.updated_at)}`}
        actions={
          <>
            <button type="button" className={BTN_SOFT} onClick={download}>
              Download CSV
            </button>
            {canEdit ? (
              <button
                type="button"
                className={BTN_DANGER}
                onClick={() => window.confirm(`Delete "${d.name}"?`) && run(() => deleteItemAction(workspaceId, "dataset", d.id))}
              >
                Delete
              </button>
            ) : null}
          </>
        }
      >
        {numericCols.length ? (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {numericCols.map((ci) => {
                const name = d.columns[ci];
                const off = hidden.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setHidden(off ? hidden.filter((h) => h !== name) : [...hidden, name])}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${off ? "bg-dash-muted text-dash-muted-foreground line-through" : "bg-dash-accent/15 text-dash-accent"}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <LineChart xLabel={d.columns[0] ?? "Row"} xs={xs} series={series} />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((s) => (
                <div key={s.name} className="bg-dash-muted/40 rounded-xl px-3 py-2 text-xs">
                  <p className="text-dash-foreground font-semibold">{s.name}</p>
                  <p className="text-dash-muted-foreground tabular-nums">
                    min {s.min.toFixed(2)} · max {s.max.toFixed(2)} · average {s.avg.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-dash-muted-foreground text-sm">Add rows with numbers to see a chart.</p>
        )}
      </Panel>

      <Panel title="Rows">
        <div className="border-dash-border max-h-96 overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-dash-muted/60 text-dash-muted-foreground sticky top-0 text-left text-xs">
              <tr>
                <th className="px-2 py-1.5">#</th>
                {d.columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 font-semibold">
                    {c}
                  </th>
                ))}
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r, ri) => (
                <tr key={ri} className="border-dash-border border-t">
                  <td className="text-dash-muted-foreground px-2 py-1 text-xs tabular-nums">{ri + 1}</td>
                  {d.columns.map((_, ci) => (
                    <td key={ci} className="px-2 py-1 tabular-nums">
                      {r[ci] ?? ""}
                    </td>
                  ))}
                  {canEdit ? (
                    <td className="px-1 text-right">
                      <button type="button" className={BTN_GHOST} disabled={pending} aria-label="Delete row" onClick={() => saveRows(d.rows.filter((_, j) => j !== ri))}>
                        ✕
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit ? (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newRow.every((c) => !c.trim())) return;
              saveRows([...d.rows, newRow.map(toCell)]);
              setNewRow(d.columns.map(() => ""));
            }}
          >
            {d.columns.map((c, ci) => (
              <Label key={c} text={c}>
                <input
                  value={newRow[ci] ?? ""}
                  onChange={(e) => setNewRow(newRow.map((v, j) => (j === ci ? e.target.value : v)))}
                  className={`${INPUT} w-32`}
                />
              </Label>
            ))}
            <button type="submit" disabled={pending} className={BTN}>
              Add row
            </button>
          </form>
        ) : null}
        <div className="mt-2">
          <Status status={status} />
        </div>
      </Panel>
    </>
  );
}
