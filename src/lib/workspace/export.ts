import { formatIeee } from "@/lib/workspace/references";
import type { WorkspaceBundle } from "@/lib/workspace/types";

function csv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `\uFEFF${rows.map((r) => r.map(esc).join(",")).join("\r\n")}`;
}

export type ExportKind = "tasks" | "logbook" | "parts" | "references";

export function buildExport(b: WorkspaceBundle, kind: string): { filename: string; type: string; body: string } | null {
  const slug = b.workspace.name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "project";
  const phase = (id: string | null) => b.phases.find((p) => p.id === id)?.name ?? "";
  const member = (id: string | null) => b.members.find((m) => m.user_id === id)?.full_name ?? "";
  switch (kind) {
    case "tasks":
      return {
        filename: `${slug}-tasks.csv`,
        type: "text/csv; charset=utf-8",
        body: csv([
          ["Phase", "Task", "Start", "Due", "Status", "Progress %", "Milestone", "Priority", "Assigned to", "Depends on"],
          ...b.tasks.map((t) => [
            phase(t.phase_id),
            t.title,
            t.start_date,
            t.due_date,
            t.status,
            t.status === "done" ? 100 : t.progress,
            t.is_milestone ? "yes" : "",
            t.priority,
            member(t.assignee_id),
            t.depends_on.map((d) => b.tasks.find((x) => x.id === d)?.title ?? "").join("; "),
          ]),
        ]),
      };
    case "logbook":
      return {
        filename: `${slug}-logbook.csv`,
        type: "text/csv; charset=utf-8",
        body: csv([
          ["Date", "Hours", "Work done", "Problems", "Next steps", "Written by"],
          ...[...b.logbook].sort((a, c) => a.entry_date.localeCompare(c.entry_date)).map((l) => [l.entry_date, l.hours, l.work_done, l.problems, l.next_steps, l.author_name]),
        ]),
      };
    case "parts":
      return {
        filename: `${slug}-parts.csv`,
        type: "text/csv; charset=utf-8",
        body: csv([
          ["Item", "Quantity", "Unit price (TSh)", "Total (TSh)", "Status", "Supplier", "Link", "Notes"],
          ...b.parts.map((p) => [p.name, p.quantity, p.unit_price_tsh, p.quantity * p.unit_price_tsh, p.status, p.supplier, p.link, p.notes]),
        ]),
      };
    case "references":
      return {
        filename: `${slug}-references.txt`,
        type: "text/plain; charset=utf-8",
        body: b.references.map((r, i) => formatIeee(r, i + 1)).join("\r\n"),
      };
    default:
      return null;
  }
}
