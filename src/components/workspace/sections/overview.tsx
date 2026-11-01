"use client";

import { updateWorkspaceAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, INPUT, Label, Panel, Status } from "@/components/workspace/ws-ui";
import { PROJECT_CATEGORIES } from "@/lib/portal/config";
import type { Workspace } from "@/lib/workspace/types";

const TEXT_FIELDS: { key: keyof Workspace; label: string; hint: string; rows: number }[] = [
  { key: "problem_statement", label: "Problem statement", hint: "What problem do you solve, for whom, and why does it matter?", rows: 4 },
  { key: "objectives", label: "Objectives", hint: "One main objective, then specific objectives (one per line).", rows: 5 },
  { key: "scope", label: "Scope", hint: "What the project covers and what it does not.", rows: 3 },
  { key: "methodology", label: "Methodology", hint: "How you will do it: design steps, tools, tests or data collection.", rows: 5 },
  { key: "expected_results", label: "Expected results", hint: "What you will deliver and how you will measure success.", rows: 3 },
  { key: "technologies", label: "Main components and technologies", hint: "For example ESP32, LoRa SX1278, Firebase, Python.", rows: 2 },
];

export function OverviewSection({ workspace: ws }: { workspace: Workspace }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const ro = !viewer.canEdit;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const values = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
        run(() => updateWorkspaceAction(workspaceId, values));
      }}
      className="space-y-5"
    >
      <Panel title="Project details" subtitle="This is the core of your proposal. Keep it up to date; it appears in your reports.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="Project title" wide>
            <input name="name" required maxLength={200} defaultValue={ws.name} className={INPUT} disabled={ro} />
          </Label>
          <Label text="Project type">
            <select name="project_category" defaultValue={ws.project_category ?? "fyp"} className={INPUT} disabled={ro}>
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Label>
          <Label text="Budget (TSh)">
            <input name="budget_tsh" type="number" min={0} step={1000} defaultValue={ws.budget_tsh ?? ""} className={INPUT} disabled={ro} />
          </Label>
          <Label text="Start date">
            <input name="start_date" type="date" defaultValue={ws.start_date ?? ""} className={INPUT} disabled={ro} />
          </Label>
          <Label text="End date">
            <input name="end_date" type="date" defaultValue={ws.end_date ?? ""} className={INPUT} disabled={ro} />
          </Label>
          <Label text="Defence date">
            <input name="defence_date" type="date" defaultValue={ws.defence_date ?? ""} className={INPUT} disabled={ro} />
          </Label>
        </div>
      </Panel>

      <Panel>
        <div className="grid gap-4">
          {TEXT_FIELDS.map((f) => (
            <Label key={f.key} text={f.label}>
              <textarea
                name={f.key}
                rows={f.rows}
                maxLength={6000}
                placeholder={f.hint}
                defaultValue={(ws[f.key] as string | null) ?? ""}
                className={`${INPUT} leading-relaxed`}
                disabled={ro}
              />
            </Label>
          ))}
        </div>
        {!ro ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className={BTN}>
              {pending ? "Saving…" : "Save project details"}
            </button>
            <Status status={status} />
          </div>
        ) : null}
      </Panel>
    </form>
  );
}
