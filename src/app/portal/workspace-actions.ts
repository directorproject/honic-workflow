"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { PAYMENT_NETWORKS, PAYMENT_PROVIDER } from "@/lib/portal/config";
import { findMembership, getSessionActor, logActivity, requireWorkspaceActor, type WorkspaceActor } from "@/lib/workspace/access";
import { MAX_UPLOAD_BYTES, STORAGE_BUCKET, formatTsh } from "@/lib/workspace/constants";
import { addDays, defaultEndDate, formatDateTime, isIsoDate, todayIso } from "@/lib/workspace/dates";
import { notifyWorkspaceMembers, portalOrigin } from "@/lib/workspace/notify";
import { buildPlan, DEFAULT_DEFENCE_CHECKS, DEFAULT_DEFENCE_QUESTIONS, DEFAULT_DOCUMENTS } from "@/lib/workspace/templates";
import { escapeHtml, sendEmail } from "@/lib/email";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type ActionResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; message: string };

const UUID_RE = /^[0-9a-f-]{36}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(err: unknown): { ok: false; message: string } {
  const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
  return { ok: false, message };
}

function refresh(workspaceId: string) {
  revalidatePath("/portal");
  revalidatePath(`/students/${workspaceId}`);
  revalidatePath("/students");
}

function line(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function text(v: unknown, max: number): string {
  return String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

// ---------------------------------------------------------------------------------------------
// Generic items: one validated schema per table.

type Field =
  | { t: "line"; max: number; required?: boolean }
  | { t: "text"; max: number; required?: boolean }
  | { t: "date"; required?: boolean }
  | { t: "time" }
  | { t: "enum"; values: readonly string[] }
  | { t: "int"; min: number; max: number }
  | { t: "num"; min: number; max: number }
  | { t: "bool" }
  | { t: "uuid" }
  | { t: "uuids" }
  | { t: "checklist" }
  | { t: "url" }
  | { t: "table" }
  | { t: "strings"; maxItems: number; max: number };

type Entity = { table: string; label: string; fields: Record<string, Field>; nameField?: string };

const ENTITIES: Record<string, Entity> = {
  phase: {
    table: "portal_phases",
    label: "phase",
    nameField: "name",
    fields: { name: { t: "line", max: 80, required: true }, color: { t: "line", max: 20 }, sort_order: { t: "int", min: 0, max: 10000 } },
  },
  task: {
    table: "portal_tasks",
    label: "task",
    nameField: "title",
    fields: {
      title: { t: "line", max: 200, required: true },
      description: { t: "text", max: 4000 },
      phase_id: { t: "uuid" },
      status: { t: "enum", values: ["todo", "doing", "done"] },
      priority: { t: "enum", values: ["low", "normal", "high"] },
      assignee_id: { t: "uuid" },
      start_date: { t: "date" },
      due_date: { t: "date" },
      progress: { t: "int", min: 0, max: 100 },
      is_milestone: { t: "bool" },
      depends_on: { t: "uuids" },
      checklist: { t: "checklist" },
      sort_order: { t: "int", min: 0, max: 100000 },
    },
  },
  event: {
    table: "portal_events",
    label: "calendar event",
    nameField: "title",
    fields: {
      kind: { t: "enum", values: ["meeting", "deadline", "presentation", "other"] },
      title: { t: "line", max: 160, required: true },
      starts_on: { t: "date", required: true },
      start_time: { t: "time" },
      end_time: { t: "time" },
      location: { t: "line", max: 160 },
      notes: { t: "text", max: 2000 },
    },
  },
  document: {
    table: "portal_documents",
    label: "document",
    nameField: "name",
    fields: {
      name: { t: "line", max: 160, required: true },
      status: { t: "enum", values: ["not_started", "draft", "submitted", "changes", "approved"] },
      due_date: { t: "date" },
      notes: { t: "text", max: 2000 },
      sort_order: { t: "int", min: 0, max: 10000 },
    },
  },
  logbook: {
    table: "portal_logbook",
    label: "logbook entry",
    fields: {
      entry_date: { t: "date", required: true },
      hours: { t: "num", min: 0, max: 24 },
      work_done: { t: "text", max: 4000, required: true },
      problems: { t: "text", max: 3000 },
      next_steps: { t: "text", max: 3000 },
    },
  },
  dataset: {
    table: "portal_datasets",
    label: "data set",
    nameField: "name",
    fields: {
      name: { t: "line", max: 120, required: true },
      notes: { t: "text", max: 2000 },
      columns: { t: "strings", maxItems: 20, max: 60 },
      rows: { t: "table" },
    },
  },
  part: {
    table: "portal_parts",
    label: "part",
    nameField: "name",
    fields: {
      name: { t: "line", max: 160, required: true },
      quantity: { t: "num", min: 0, max: 100000 },
      unit_price_tsh: { t: "int", min: 0, max: 1_000_000_000 },
      status: { t: "enum", values: ["needed", "ordered", "bought"] },
      supplier: { t: "line", max: 120 },
      link: { t: "url" },
      notes: { t: "text", max: 1000 },
      sort_order: { t: "int", min: 0, max: 10000 },
    },
  },
  reference: {
    table: "portal_references",
    label: "reference",
    nameField: "title",
    fields: {
      kind: { t: "enum", values: ["article", "book", "website", "datasheet", "thesis", "other"] },
      authors: { t: "line", max: 400 },
      title: { t: "line", max: 400, required: true },
      year: { t: "line", max: 10 },
      source: { t: "line", max: 240 },
      volume: { t: "line", max: 40 },
      pages: { t: "line", max: 40 },
      url: { t: "url" },
      doi: { t: "line", max: 120 },
      accessed_on: { t: "date" },
      notes: { t: "text", max: 1000 },
    },
  },
  defence: {
    table: "portal_defence_items",
    label: "defence item",
    fields: {
      kind: { t: "enum", values: ["check", "question"] },
      text: { t: "line", max: 400, required: true },
      answer: { t: "text", max: 3000 },
      done: { t: "bool" },
      sort_order: { t: "int", min: 0, max: 10000 },
    },
  },
};

export type EntityName = keyof typeof ENTITIES;

function parseField(name: string, f: Field, v: unknown): unknown {
  const empty = v === null || v === undefined || v === "";
  switch (f.t) {
    case "line":
    case "text": {
      const s = f.t === "line" ? line(v, f.max) : text(v, f.max);
      if (f.required && !s) throw new Error(`Fill in ${name.replace(/_/g, " ")}.`);
      return s || null;
    }
    case "date":
      if (empty) {
        if (f.required) throw new Error(`Choose a date for ${name.replace(/_/g, " ")}.`);
        return null;
      }
      if (!isIsoDate(v)) throw new Error("Use a valid date.");
      return v;
    case "time":
      if (empty) return null;
      if (typeof v !== "string" || !/^\d{2}:\d{2}$/.test(v)) throw new Error("Use a valid time.");
      return v;
    case "enum":
      if (typeof v !== "string" || !f.values.includes(v)) throw new Error(`Choose a valid ${name.replace(/_/g, " ")}.`);
      return v;
    case "int":
    case "num": {
      if (empty) return f.t === "int" ? 0 : null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < f.min || n > f.max) throw new Error(`Enter a valid number for ${name.replace(/_/g, " ")}.`);
      return f.t === "int" ? Math.round(n) : Math.round(n * 100) / 100;
    }
    case "bool":
      return Boolean(v);
    case "uuid":
      if (empty) return null;
      if (typeof v !== "string" || !UUID_RE.test(v)) throw new Error("Invalid reference.");
      return v;
    case "uuids":
      if (!Array.isArray(v)) return [];
      return [...new Set(v.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))].slice(0, 30);
    case "checklist":
      if (!Array.isArray(v)) return [];
      return v
        .slice(0, 50)
        .map((i) => ({ text: line((i as { text?: unknown })?.text, 200), done: Boolean((i as { done?: unknown })?.done) }))
        .filter((i) => i.text);
    case "url": {
      const s = line(v, 500);
      if (!s) return null;
      if (!/^https?:\/\//i.test(s)) return `https://${s}`;
      return s;
    }
    case "strings":
      if (!Array.isArray(v)) return [];
      return v.slice(0, f.maxItems).map((s) => line(s, f.max) || "Column");
    case "table": {
      if (!Array.isArray(v)) return [];
      if (v.length > 5000) throw new Error("A data set can have up to 5000 rows.");
      return v.map((r) =>
        (Array.isArray(r) ? r : []).slice(0, 20).map((c) => {
          if (c === null || c === undefined || c === "") return null;
          const n = typeof c === "number" ? c : Number(String(c).trim());
          return Number.isFinite(n) && String(c).trim() !== "" ? n : line(c, 120);
        }),
      );
    }
  }
}

async function assertInWorkspace(actor: WorkspaceActor, table: string, ids: string[]) {
  if (!ids.length) return;
  const { data } = await actor.db.from(table).select("id").eq("workspace_id", actor.workspaceId).in("id", ids);
  if ((data ?? []).length !== new Set(ids).size) throw new Error("Invalid reference.");
}

async function validateTaskRefs(actor: WorkspaceActor, row: Record<string, unknown>, selfId: string | null) {
  if (typeof row.phase_id === "string") await assertInWorkspace(actor, "portal_phases", [row.phase_id]);
  if (Array.isArray(row.depends_on)) {
    const deps = (row.depends_on as string[]).filter((d) => d !== selfId);
    row.depends_on = deps;
    await assertInWorkspace(actor, "portal_tasks", deps);
  }
  if (typeof row.assignee_id === "string") {
    const { data } = await actor.db
      .from("portal_workspace_members")
      .select("user_id")
      .eq("workspace_id", actor.workspaceId)
      .eq("user_id", row.assignee_id)
      .maybeSingle();
    if (!data) throw new Error("Assign the task to a team member.");
  }
  if (typeof row.start_date === "string" && typeof row.due_date === "string" && row.due_date < row.start_date) {
    throw new Error("The due date must be on or after the start date.");
  }
  if (row.status === "done") {
    row.progress = 100;
    row.completed_at = new Date().toISOString();
  } else if (row.status === "todo" || row.status === "doing") {
    row.completed_at = null;
  }
}

/** Create (id = null) or update an item. Only fields present in `values` are written. */
export async function saveItemAction(
  workspaceId: string,
  entity: EntityName,
  id: string | null,
  values: Record<string, unknown>,
  options: { quiet?: boolean } = {},
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const spec = ENTITIES[entity];
    if (!spec) throw new Error("Unknown item.");
    if (id !== null && !UUID_RE.test(String(id))) throw new Error("Item not found.");

    const row: Record<string, unknown> = {};
    for (const [key, f] of Object.entries(spec.fields)) {
      if (key in values) row[key] = parseField(key, f, values[key]);
      else if (id === null && "required" in f && f.required) throw new Error(`Fill in ${key.replace(/_/g, " ")}.`);
    }
    if (entity === "task") await validateTaskRefs(actor, row, id);
    if (entity === "logbook" && id === null) {
      row.author_id = actor.userId;
      row.author_name = actor.name;
    }
    if (["portal_tasks", "portal_documents", "portal_logbook", "portal_datasets", "portal_parts"].includes(spec.table)) {
      row.updated_at = new Date().toISOString();
    }

    let savedId = id;
    if (id === null) {
      const { data, error } = await actor.db
        .from(spec.table)
        .insert({ ...row, workspace_id: actor.workspaceId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      savedId = String(data.id);
    } else {
      const { data, error } = await actor.db
        .from(spec.table)
        .update(row)
        .eq("id", id)
        .eq("workspace_id", actor.workspaceId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Item not found.");
    }

    if (!options.quiet) {
      const name = spec.nameField && typeof row[spec.nameField] === "string" ? ` "${row[spec.nameField]}"` : "";
      const verb = id === null ? "added" : row.status === "done" ? "completed" : "updated";
      await logActivity(actor.db, actor.workspaceId, actor.name, `${verb} ${spec.label}${name}`);
    }
    refresh(actor.workspaceId);
    return { ok: true, data: { id: String(savedId) } };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteItemAction(workspaceId: string, entity: EntityName, id: string): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const spec = ENTITIES[entity];
    if (!spec || !UUID_RE.test(String(id))) throw new Error("Item not found.");
    const cols = spec.nameField ? `id, ${spec.nameField}` : "id";
    const { data, error } = await actor.db
      .from(spec.table)
      .delete()
      .eq("id", id)
      .eq("workspace_id", actor.workspaceId)
      .select(cols)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Item not found.");
    if (entity === "task") {
      const { data: dependents } = await actor.db
        .from("portal_tasks")
        .select("id, depends_on")
        .eq("workspace_id", actor.workspaceId)
        .contains("depends_on", [id]);
      await Promise.all(
        (dependents ?? []).map((t) =>
          actor.db
            .from("portal_tasks")
            .update({ depends_on: (t.depends_on as string[]).filter((d) => d !== id) })
            .eq("id", t.id),
        ),
      );
    }
    const name = spec.nameField ? ` "${(data as unknown as Record<string, unknown>)[spec.nameField]}"` : "";
    await logActivity(actor.db, actor.workspaceId, actor.name, `deleted ${spec.label}${name}`);
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------------------------
// Workspace

async function seedWorkspace(
  db: WorkspaceActor["db"],
  workspaceId: string,
  category: string,
  start: string,
  end: string,
  withPlan: boolean,
) {
  if (withPlan) await insertPlan(db, workspaceId, category, start, end);
  const docs = DEFAULT_DOCUMENTS[category] ?? DEFAULT_DOCUMENTS.fyp;
  await db.from("portal_documents").insert(docs.map((name, i) => ({ workspace_id: workspaceId, name, sort_order: i })));
  await db.from("portal_defence_items").insert([
    ...DEFAULT_DEFENCE_CHECKS.map((t, i) => ({ workspace_id: workspaceId, kind: "check", text: t, sort_order: i })),
    ...DEFAULT_DEFENCE_QUESTIONS.map((t, i) => ({ workspace_id: workspaceId, kind: "question", text: t, sort_order: i })),
  ]);
}

async function insertPlan(db: WorkspaceActor["db"], workspaceId: string, category: string, start: string, end: string) {
  const plan = buildPlan(category, start, end);
  const { data: phases, error } = await db
    .from("portal_phases")
    .insert(plan.phases.map((p, i) => ({ workspace_id: workspaceId, name: p.name, color: p.color, sort_order: i })))
    .select("id, sort_order");
  if (error) throw new Error(error.message);
  const phaseIds = (phases ?? []).sort((a, b) => a.sort_order - b.sort_order).map((p) => String(p.id));
  const taskIds = plan.tasks.map(() => randomUUID());
  const { error: tErr } = await db.from("portal_tasks").insert(
    plan.tasks.map((t, i) => ({
      id: taskIds[i],
      workspace_id: workspaceId,
      phase_id: phaseIds[t.phaseIndex],
      title: t.title,
      start_date: t.start_date,
      due_date: t.due_date,
      is_milestone: t.is_milestone,
      depends_on: t.dependsOnIndex === null ? [] : [taskIds[t.dependsOnIndex]],
      sort_order: i,
    })),
  );
  if (tErr) throw new Error(tErr.message);
}

export async function createWorkspaceAction(input: {
  name: string;
  category: string;
  startDate: string;
  endDate: string;
  defenceDate: string;
  withPlan: boolean;
}): Promise<ActionResult> {
  try {
    const actor = await getSessionActor();
    if (!actor) throw new Error("Please sign in again.");
    if (actor.kind !== "student") throw new Error("Only students create workspaces.");
    const { db } = actor;
    if (await findMembership(db, actor.userId)) throw new Error("You already have a project workspace.");
    const { data: profile } = await db
      .from("student_profiles")
      .select("project_category")
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (!profile) throw new Error("Fill in your details first.");

    const category = ["fyp", "research", "innovation"].includes(input.category) ? input.category : String(profile.project_category ?? "fyp");
    const start = isIsoDate(input.startDate) ? input.startDate : todayIso();
    const end = isIsoDate(input.endDate) && input.endDate > start ? input.endDate : defaultEndDate(start);
    const defence = isIsoDate(input.defenceDate) ? input.defenceDate : null;

    const { data: title } = await db
      .from("title_proposals")
      .select("id, title, summary")
      .eq("selected_by", actor.userId)
      .maybeSingle();
    const name = line(input.name, 200) || String(title?.title ?? "") || "My project";

    const { data: ws, error } = await db
      .from("portal_workspaces")
      .insert({
        name,
        title_proposal_id: title?.id ?? null,
        project_category: category,
        problem_statement: title?.summary ?? null,
        start_date: start,
        end_date: end,
        defence_date: defence,
        created_by: actor.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const workspaceId = String(ws.id);

    const { error: mErr } = await db
      .from("portal_workspace_members")
      .insert({ workspace_id: workspaceId, user_id: actor.userId, role: "leader" });
    if (mErr) {
      await db.from("portal_workspaces").delete().eq("id", workspaceId);
      throw new Error("You already have a project workspace.");
    }
    await seedWorkspace(db, workspaceId, category, start, end, input.withPlan);
    await logActivity(db, workspaceId, actor.name, "created the workspace");
    refresh(workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

const WORKSPACE_FIELDS: Record<string, Field> = {
  name: { t: "line", max: 200, required: true },
  project_category: { t: "enum", values: ["fyp", "research", "innovation"] },
  problem_statement: { t: "text", max: 6000 },
  objectives: { t: "text", max: 6000 },
  scope: { t: "text", max: 4000 },
  methodology: { t: "text", max: 6000 },
  expected_results: { t: "text", max: 4000 },
  technologies: { t: "text", max: 2000 },
  start_date: { t: "date" },
  end_date: { t: "date" },
  defence_date: { t: "date" },
  supervisor_name: { t: "line", max: 120 },
  supervisor_email: { t: "line", max: 254 },
  supervisor_phone: { t: "line", max: 40 },
  supervisor_meetings: { t: "line", max: 200 },
  budget_tsh: { t: "int", min: 0, max: 1_000_000_000 },
};

export async function updateWorkspaceAction(workspaceId: string, values: Record<string, unknown>): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [key, f] of Object.entries(WORKSPACE_FIELDS)) {
      if (key in values) row[key] = parseField(key, f, values[key]);
    }
    if (typeof row.supervisor_email === "string" && row.supervisor_email && !EMAIL_RE.test(row.supervisor_email)) {
      throw new Error("Enter a valid supervisor email.");
    }
    const { error } = await actor.db.from("portal_workspaces").update(row).eq("id", actor.workspaceId);
    if (error) throw new Error(error.message);
    await logActivity(actor.db, actor.workspaceId, actor.name, "updated the project details");
    refresh(actor.workspaceId);
    return { ok: true, message: "Saved." };
  } catch (err) {
    return fail(err);
  }
}

/** Adds a ready-made plan. With replace, existing phases and tasks are removed first. */
export async function applyTemplateAction(
  workspaceId: string,
  input: { category: string; startDate: string; endDate: string; replace: boolean },
): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate) || input.endDate <= input.startDate) {
      throw new Error("Choose a start date before the end date.");
    }
    if (input.replace) {
      await actor.db.from("portal_tasks").delete().eq("workspace_id", actor.workspaceId);
      await actor.db.from("portal_phases").delete().eq("workspace_id", actor.workspaceId);
    }
    await insertPlan(actor.db, actor.workspaceId, input.category, input.startDate, input.endDate);
    await actor.db
      .from("portal_workspaces")
      .update({ start_date: input.startDate, end_date: input.endDate })
      .eq("id", actor.workspaceId);
    await logActivity(actor.db, actor.workspaceId, actor.name, `added the ready-made ${input.category.toUpperCase()} plan`);
    refresh(actor.workspaceId);
    return { ok: true, message: "Plan added." };
  } catch (err) {
    return fail(err);
  }
}

export async function applyRescheduleAction(
  workspaceId: string,
  changes: { id: string; start_date: string; due_date: string }[],
): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const valid = changes
      .slice(0, 500)
      .filter((c) => UUID_RE.test(c.id) && isIsoDate(c.start_date) && isIsoDate(c.due_date) && c.due_date >= c.start_date);
    await assertInWorkspace(actor, "portal_tasks", valid.map((c) => c.id));
    await Promise.all(
      valid.map((c) =>
        actor.db
          .from("portal_tasks")
          .update({ start_date: c.start_date, due_date: c.due_date, updated_at: new Date().toISOString() })
          .eq("id", c.id)
          .eq("workspace_id", actor.workspaceId),
      ),
    );
    await logActivity(actor.db, actor.workspaceId, actor.name, `moved ${valid.length} task dates to catch up`);
    refresh(actor.workspaceId);
    return { ok: true, message: `${valid.length} tasks moved.` };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteWorkspaceAction(workspaceId: string): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    if (actor.role === "member") throw new Error("Only the team leader can delete the workspace.");
    const { data: files } = await actor.db.from("portal_files").select("storage_path").eq("workspace_id", actor.workspaceId);
    const paths = (files ?? []).map((f) => String(f.storage_path));
    if (paths.length) await actor.db.storage.from(STORAGE_BUCKET).remove(paths);
    const { error } = await actor.db.from("portal_workspaces").delete().eq("id", actor.workspaceId);
    if (error) throw new Error(error.message);
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------------------------
// Team

export async function inviteMemberAction(workspaceId: string, email: string): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const e = line(email, 254).toLowerCase();
    if (!EMAIL_RE.test(e)) throw new Error("Enter a valid email address.");
    const { count } = await actor.db
      .from("portal_workspace_members")
      .select("user_id", { count: "exact", head: true })
      .eq("workspace_id", actor.workspaceId);
    if ((count ?? 0) >= 6) throw new Error("A team can have up to 6 members.");
    const token = randomBytes(18).toString("base64url");
    const { error } = await actor.db
      .from("portal_workspace_invites")
      .upsert(
        { workspace_id: actor.workspaceId, email: e, token, invited_by: actor.userId, accepted_at: null, created_at: new Date().toISOString() },
        { onConflict: "workspace_id,email" },
      );
    if (error) throw new Error(error.message);

    const { data: ws } = await actor.db.from("portal_workspaces").select("name").eq("id", actor.workspaceId).single();
    const projectName = String(ws?.name ?? "a project");
    const link = `${portalOrigin()}/portal/join/${token}`;
    const sent = await sendEmail({
      to: e,
      subject: `${actor.name} invited you to a project on Honic`,
      text: `${actor.name} invited you to join the project "${projectName}" on the Honic student portal.\n\nCreate an account or sign in with this email, then open: ${link}\n\nHonic Company Limited · Innovation and Research Department`,
      html: `<p>${escapeHtml(actor.name)} invited you to join the project <strong>${escapeHtml(projectName)}</strong> on the Honic student portal.</p><p>Create an account or sign in with this email, then open the link:</p><p><a href="${escapeHtml(link)}">Join the project</a></p><p style="color:#64748b">Honic Company Limited · Innovation and Research Department</p>`,
    });
    await logActivity(actor.db, actor.workspaceId, actor.name, `invited ${e}`);
    refresh(actor.workspaceId);
    return {
      ok: true,
      message: sent.ok && !("skipped" in sent && sent.skipped) ? `Invitation sent to ${e}.` : `Invitation created. Send this link to ${e}: ${link}`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelInviteAction(workspaceId: string, inviteId: string): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    await actor.db.from("portal_workspace_invites").delete().eq("id", inviteId).eq("workspace_id", actor.workspaceId);
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function acceptInviteAction(token: string): Promise<ActionResult> {
  try {
    const actor = await getSessionActor();
    if (!actor) throw new Error("Sign in first, then open the invitation link again.");
    if (actor.kind !== "student") throw new Error("Staff accounts cannot join a student team.");
    const { data: invite } = await actor.db
      .from("portal_workspace_invites")
      .select("id, workspace_id, email, accepted_at")
      .eq("token", line(token, 64))
      .maybeSingle();
    if (!invite || invite.accepted_at) throw new Error("This invitation is not valid any more.");
    if (String(invite.email).toLowerCase() !== actor.email.toLowerCase()) {
      throw new Error(`This invitation is for ${invite.email}. Sign in with that email.`);
    }
    const { data: profile } = await actor.db.from("student_profiles").select("user_id").eq("user_id", actor.userId).maybeSingle();
    if (!profile) throw new Error("Fill in your details first, then open the invitation link again.");
    const existing = await findMembership(actor.db, actor.userId);
    if (existing) {
      if (existing.workspaceId === invite.workspace_id) return { ok: true };
      throw new Error("You already have a workspace. Leave or delete it first (Team page), then accept.");
    }
    const { error } = await actor.db
      .from("portal_workspace_members")
      .insert({ workspace_id: invite.workspace_id, user_id: actor.userId, role: "member" });
    if (error) throw new Error(error.message);
    await actor.db.from("portal_workspace_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    await logActivity(actor.db, String(invite.workspace_id), actor.name, "joined the team");
    refresh(String(invite.workspace_id));
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function removeMemberAction(workspaceId: string, userId: string): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const self = userId === actor.userId;
    if (!self && actor.role === "member") throw new Error("Only the team leader can remove members.");
    const { data: members } = await actor.db
      .from("portal_workspace_members")
      .select("user_id, role")
      .eq("workspace_id", actor.workspaceId);
    const target = (members ?? []).find((m) => String(m.user_id) === userId);
    if (!target) throw new Error("Member not found.");
    if ((members ?? []).length === 1) throw new Error("You are the only member. Delete the workspace instead.");
    await actor.db.from("portal_workspace_members").delete().eq("workspace_id", actor.workspaceId).eq("user_id", userId);
    if (target.role === "leader") {
      const next = (members ?? []).find((m) => String(m.user_id) !== userId);
      if (next) {
        await actor.db
          .from("portal_workspace_members")
          .update({ role: "leader" })
          .eq("workspace_id", actor.workspaceId)
          .eq("user_id", next.user_id);
      }
    }
    await logActivity(actor.db, actor.workspaceId, actor.name, self ? "left the team" : "removed a team member");
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setSupervisorLinkAction(workspaceId: string, enabled: boolean, regenerate = false): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const { data: ws } = await actor.db.from("portal_workspaces").select("supervisor_token").eq("id", actor.workspaceId).single();
    const token = !ws?.supervisor_token || regenerate ? randomBytes(18).toString("base64url") : String(ws.supervisor_token);
    await actor.db
      .from("portal_workspaces")
      .update({ supervisor_token: token, supervisor_link_enabled: enabled })
      .eq("id", actor.workspaceId);
    await logActivity(actor.db, actor.workspaceId, actor.name, enabled ? "turned on the supervisor link" : "turned off the supervisor link");
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------------------------
// Files

export async function createUploadAction(
  workspaceId: string,
  meta: { name: string; size: number },
): Promise<ActionResult<{ path: string; token: string }>> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const size = Number(meta.size);
    if (!Number.isFinite(size) || size <= 0) throw new Error("The file is empty.");
    if (size > MAX_UPLOAD_BYTES) throw new Error("Files can be up to 25 MB.");
    const { data: used } = await actor.db.from("portal_files").select("size_bytes").eq("workspace_id", actor.workspaceId);
    const total = (used ?? []).reduce((s, f) => s + Number(f.size_bytes ?? 0), 0);
    if (total + size > 500 * 1024 * 1024) throw new Error("This workspace has reached its 500 MB storage limit.");
    const safe = line(meta.name, 120).replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_") || "file";
    const path = `${actor.workspaceId}/${randomUUID()}-${safe}`;
    const { data, error } = await actor.db.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "Could not start the upload.");
    return { ok: true, data: { path: data.path, token: data.token } };
  } catch (err) {
    return fail(err);
  }
}

export async function confirmUploadAction(
  workspaceId: string,
  meta: { path: string; name: string; type: string; folder: string; documentId: string | null },
): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const path = String(meta.path ?? "");
    if (!path.startsWith(`${actor.workspaceId}/`) || path.includes("..")) throw new Error("Invalid upload.");
    const fileName = path.slice(actor.workspaceId.length + 1);
    const { data: listed } = await actor.db.storage.from(STORAGE_BUCKET).list(actor.workspaceId, { search: fileName, limit: 1 });
    const obj = (listed ?? []).find((o) => o.name === fileName);
    if (!obj) throw new Error("The upload did not finish. Please try again.");
    const documentId = meta.documentId && UUID_RE.test(meta.documentId) ? meta.documentId : null;
    if (documentId) await assertInWorkspace(actor, "portal_documents", [documentId]);
    const name = line(meta.name, 200) || fileName;
    const { error } = await actor.db.from("portal_files").insert({
      workspace_id: actor.workspaceId,
      document_id: documentId,
      folder: line(meta.folder, 60) || "General",
      name,
      storage_path: path,
      size_bytes: Number((obj.metadata as { size?: number } | null)?.size ?? 0),
      mime_type: line(meta.type, 120) || null,
      uploaded_by: actor.userId,
      uploaded_by_name: actor.name,
    });
    if (error) throw new Error(error.message);
    if (documentId) {
      await actor.db.from("portal_documents").update({ updated_at: new Date().toISOString() }).eq("id", documentId);
    }
    await logActivity(actor.db, actor.workspaceId, actor.name, `uploaded "${name}"`);
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteFileAction(workspaceId: string, fileId: string): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const { data: f } = await actor.db
      .from("portal_files")
      .select("id, name, storage_path")
      .eq("id", fileId)
      .eq("workspace_id", actor.workspaceId)
      .maybeSingle();
    if (!f) throw new Error("File not found.");
    await actor.db.storage.from(STORAGE_BUCKET).remove([String(f.storage_path)]);
    await actor.db.from("portal_files").delete().eq("id", f.id);
    await logActivity(actor.db, actor.workspaceId, actor.name, `deleted file "${f.name}"`);
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------------------------
// Messages, comments, sessions, payments

export async function sendMessageAction(workspaceId: string, body: string): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const msg = text(body, 4000);
    if (!msg) throw new Error("Write a message first.");
    const now = new Date().toISOString();
    const { error } = await actor.db.from("portal_messages").insert({
      workspace_id: actor.workspaceId,
      author_kind: actor.kind,
      author_id: actor.userId,
      author_name: actor.name,
      body: msg,
      staff_read_at: actor.kind === "staff" ? now : null,
      student_read_at: actor.kind === "student" ? now : null,
    });
    if (error) throw new Error(error.message);
    await actor.db.from("portal_workspaces").update({ last_activity_at: now }).eq("id", actor.workspaceId);
    if (actor.kind === "staff") {
      await notifyWorkspaceMembers(actor.db, actor.workspaceId, {
        subject: "New message from Honic",
        message: `${actor.name}: ${msg.slice(0, 300)}`,
        tab: "messages",
      });
    } else {
      await notifyWorkspaceMembers(actor.db, actor.workspaceId, {
        subject: `New message from ${actor.name}`,
        message: msg.slice(0, 300),
        tab: "messages",
        exceptUserId: actor.userId,
      });
    }
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function markMessagesReadAction(workspaceId: string): Promise<void> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const col = actor.kind === "staff" ? "staff_read_at" : "student_read_at";
    await actor.db
      .from("portal_messages")
      .update({ [col]: new Date().toISOString() })
      .eq("workspace_id", actor.workspaceId)
      .is(col, null);
  } catch {
    /* reading is best effort */
  }
}

async function insertComment(
  db: WorkspaceActor["db"],
  workspaceId: string,
  author: { kind: string; id: string | null; name: string },
  targetType: string,
  targetId: string,
  body: string,
) {
  if (!["document", "logbook"].includes(targetType) || !UUID_RE.test(targetId)) throw new Error("Invalid item.");
  const table = targetType === "document" ? "portal_documents" : "portal_logbook";
  const { data: target } = await db.from(table).select("id").eq("id", targetId).eq("workspace_id", workspaceId).maybeSingle();
  if (!target) throw new Error("Item not found.");
  const msg = text(body, 3000);
  if (!msg) throw new Error("Write a comment first.");
  const { error } = await db.from("portal_comments").insert({
    workspace_id: workspaceId,
    target_type: targetType,
    target_id: targetId,
    author_kind: author.kind,
    author_id: author.id,
    author_name: author.name,
    body: msg,
  });
  if (error) throw new Error(error.message);
  return msg;
}

export async function addCommentAction(
  workspaceId: string,
  targetType: string,
  targetId: string,
  body: string,
): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const msg = await insertComment(actor.db, actor.workspaceId, { kind: actor.kind, id: actor.userId, name: actor.name }, targetType, targetId, body);
    await logActivity(actor.db, actor.workspaceId, actor.name, `commented on a ${targetType === "document" ? "document" : "logbook entry"}`);
    if (actor.kind === "staff") {
      await notifyWorkspaceMembers(actor.db, actor.workspaceId, {
        subject: "Honic left feedback",
        message: `${actor.name}: ${msg.slice(0, 300)}`,
        tab: targetType === "document" ? "documents" : "logbook",
      });
    }
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Comment from the supervisor's read-only link. */
export async function supervisorCommentAction(
  token: string,
  targetType: string,
  targetId: string,
  name: string,
  body: string,
): Promise<ActionResult> {
  try {
    const db = getSupabaseAdminClient();
    if (!db) throw new Error("Service unavailable.");
    const { data: ws } = await db
      .from("portal_workspaces")
      .select("id, supervisor_link_enabled, supervisor_name")
      .eq("supervisor_token", line(token, 64))
      .maybeSingle();
    if (!ws || !ws.supervisor_link_enabled) throw new Error("This link is not active.");
    const author = line(name, 80) || String(ws.supervisor_name ?? "") || "Supervisor";
    const msg = await insertComment(db, String(ws.id), { kind: "supervisor", id: null, name: author }, targetType, targetId, body);
    await logActivity(db, String(ws.id), `${author} (supervisor)`, "left feedback");
    await notifyWorkspaceMembers(db, String(ws.id), {
      subject: "Your supervisor left feedback",
      message: `${author}: ${msg.slice(0, 300)}`,
      tab: targetType === "document" ? "documents" : "logbook",
    });
    revalidatePath(`/portal/s/${token}`);
    refresh(String(ws.id));
    return { ok: true, message: "Thank you. Your comment was sent to the students." };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteCommentAction(workspaceId: string, commentId: string): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    let q = actor.db.from("portal_comments").delete().eq("id", commentId).eq("workspace_id", actor.workspaceId);
    if (actor.kind !== "staff") q = q.eq("author_id", actor.userId);
    await q;
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function requestBookingAction(
  workspaceId: string,
  input: { kind: string; topic: string; preferredAt: string; durationMin: number },
): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const kind = ["meeting", "lab", "online"].includes(input.kind) ? input.kind : "meeting";
    const topic = line(input.topic, 200);
    if (!topic) throw new Error("Say what the session is for.");
    const when = new Date(input.preferredAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 3600_000) throw new Error("Choose a time in the future.");
    const duration = Math.min(480, Math.max(15, Math.round(Number(input.durationMin) || 60)));
    const { error } = await actor.db.from("portal_bookings").insert({
      workspace_id: actor.workspaceId,
      kind,
      topic,
      preferred_at: when.toISOString(),
      duration_min: duration,
      requested_by: actor.userId,
      requested_by_name: actor.name,
      status: actor.kind === "staff" ? "confirmed" : "requested",
      confirmed_at: actor.kind === "staff" ? when.toISOString() : null,
    });
    if (error) throw new Error(error.message);
    await logActivity(actor.db, actor.workspaceId, actor.name, `requested a session: ${topic}`);
    if (actor.kind === "staff") {
      await notifyWorkspaceMembers(actor.db, actor.workspaceId, {
        subject: "Honic booked a session",
        message: `${topic} on ${formatDateTime(when.toISOString())}.`,
        tab: "sessions",
      });
    }
    refresh(actor.workspaceId);
    return { ok: true, message: actor.kind === "staff" ? "Session booked." : "Request sent. Honic will confirm the time." };
  } catch (err) {
    return fail(err);
  }
}

export async function updateBookingAction(
  workspaceId: string,
  bookingId: string,
  input: { status: string; confirmedAt?: string; note?: string },
): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const allowed = actor.kind === "staff" ? ["confirmed", "declined", "cancelled", "done", "requested"] : ["cancelled"];
    if (!allowed.includes(input.status)) throw new Error("Only Honic can confirm or decline sessions.");
    const row: Record<string, unknown> = { status: input.status, updated_at: new Date().toISOString() };
    if (actor.kind === "staff") {
      row.staff_note = text(input.note, 1000) || null;
      if (input.status === "confirmed") {
        const when = new Date(String(input.confirmedAt ?? ""));
        if (Number.isNaN(when.getTime())) throw new Error("Choose the confirmed time.");
        row.confirmed_at = when.toISOString();
      }
    }
    const { data: b, error } = await actor.db
      .from("portal_bookings")
      .update(row)
      .eq("id", bookingId)
      .eq("workspace_id", actor.workspaceId)
      .select("topic, confirmed_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Error("Session not found.");
    await logActivity(actor.db, actor.workspaceId, actor.name, `marked session "${b.topic}" as ${input.status}`);
    if (actor.kind === "staff" && ["confirmed", "declined"].includes(input.status)) {
      await notifyWorkspaceMembers(actor.db, actor.workspaceId, {
        subject: input.status === "confirmed" ? "Your session is confirmed" : "Your session request was declined",
        message:
          input.status === "confirmed"
            ? `${b.topic}: ${formatDateTime(String(b.confirmed_at))}.${row.staff_note ? ` ${row.staff_note}` : ""}`
            : `${b.topic}.${row.staff_note ? ` ${row.staff_note}` : " Please request another time."}`,
        tab: "sessions",
      });
    }
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function createInvoiceAction(
  workspaceId: string,
  input: { description: string; amount: number; status: string; dueDate: string },
): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    if (actor.kind !== "staff") throw new Error("Only Honic creates invoices.");
    const description = line(input.description, 240);
    const amount = Math.round(Number(input.amount));
    if (!description) throw new Error("Describe the service.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter the amount in TSh.");
    const status = input.status === "quote" ? "quote" : "unpaid";
    const { error } = await actor.db.from("portal_invoices").insert({
      workspace_id: actor.workspaceId,
      description,
      amount_tsh: amount,
      status,
      due_date: isIsoDate(input.dueDate) ? input.dueDate : null,
      created_by: actor.userId,
    });
    if (error) throw new Error(error.message);
    await logActivity(actor.db, actor.workspaceId, actor.name, `added ${status === "quote" ? "a quote" : "an invoice"}: ${description}`);
    await notifyWorkspaceMembers(actor.db, actor.workspaceId, {
      subject: status === "quote" ? "New quote from Honic" : "New invoice from Honic",
      message: `${description}: ${formatTsh(amount)}.`,
      tab: "payments",
    });
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setInvoiceStatusAction(workspaceId: string, invoiceId: string, status: string): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    if (actor.kind !== "staff") throw new Error("Only Honic changes invoices.");
    if (!["quote", "unpaid", "cancelled"].includes(status)) throw new Error("Invalid status.");
    await actor.db.from("portal_invoices").update({ status }).eq("id", invoiceId).eq("workspace_id", actor.workspaceId).neq("status", "paid");
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Simulated mobile-money payment until a provider is connected. */
export async function payInvoiceAction(
  workspaceId: string,
  invoiceId: string,
  input: { network: string; phone: string },
): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    if (!(PAYMENT_NETWORKS as readonly string[]).includes(input.network)) throw new Error("Choose your mobile money network.");
    const phone = line(input.phone, 30);
    if (phone.replace(/\D/g, "").length < 9) throw new Error("Enter the phone number that will pay.");
    const reference = `SIM-${randomBytes(4).toString("hex").toUpperCase()}`;
    const { data, error } = await actor.db
      .from("portal_invoices")
      .update({ status: "paid", paid_at: new Date().toISOString(), network: input.network, phone, reference })
      .eq("id", invoiceId)
      .eq("workspace_id", actor.workspaceId)
      .eq("status", "unpaid")
      .select("description, amount_tsh")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("This invoice is not waiting for payment.");
    await logActivity(actor.db, actor.workspaceId, actor.name, `paid ${formatTsh(Number(data.amount_tsh))} for ${data.description} (${PAYMENT_PROVIDER})`);
    refresh(actor.workspaceId);
    return { ok: true, message: `Paid. Reference ${reference}.` };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------------------------
// Staff: shared deadlines

export async function saveDeadlineAction(
  id: string | null,
  input: { title: string; dueDate: string; institution: string; courseCode: string; projectCategory: string; notes: string },
): Promise<ActionResult> {
  try {
    const actor = await getSessionActor();
    if (actor?.kind !== "staff") throw new Error("Staff only.");
    const row = {
      title: line(input.title, 160),
      due_date: input.dueDate,
      institution: line(input.institution, 160) || null,
      course_code: line(input.courseCode, 12).toUpperCase() || null,
      project_category: ["fyp", "research", "innovation"].includes(input.projectCategory) ? input.projectCategory : null,
      notes: text(input.notes, 1000) || null,
    };
    if (!row.title) throw new Error("Give the deadline a title.");
    if (!isIsoDate(row.due_date)) throw new Error("Choose the date.");
    const { error } = id
      ? await actor.db.from("portal_deadlines").update(row).eq("id", id)
      : await actor.db.from("portal_deadlines").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/students/deadlines");
    revalidatePath("/portal");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteDeadlineAction(id: string): Promise<ActionResult> {
  try {
    const actor = await getSessionActor();
    if (actor?.kind !== "staff") throw new Error("Staff only.");
    await actor.db.from("portal_deadlines").delete().eq("id", id);
    revalidatePath("/students/deadlines");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------------------------
// Push notifications for the portal

export async function savePushSubscriptionAction(sub: {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}): Promise<ActionResult> {
  try {
    const actor = await getSessionActor();
    if (!actor) throw new Error("Please sign in again.");
    const endpoint = String(sub.endpoint ?? "");
    if (!/^https:\/\//.test(endpoint) || !sub.keys?.p256dh || !sub.keys.auth) throw new Error("Invalid subscription.");
    const { error } = await actor.db.from("portal_push_subscriptions").upsert({
      endpoint,
      user_id: actor.userId,
      p256dh: String(sub.keys.p256dh),
      auth: String(sub.keys.auth),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  try {
    const actor = await getSessionActor();
    if (!actor) throw new Error("Please sign in again.");
    await actor.db.from("portal_push_subscriptions").delete().eq("endpoint", String(endpoint)).eq("user_id", actor.userId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function shiftAllTasksAction(workspaceId: string, days: number): Promise<ActionResult> {
  try {
    const actor = await requireWorkspaceActor(workspaceId);
    const n = Math.round(Number(days));
    if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 365) throw new Error("Choose how many days to move.");
    const { data: tasks } = await actor.db
      .from("portal_tasks")
      .select("id, start_date, due_date")
      .eq("workspace_id", actor.workspaceId)
      .neq("status", "done");
    await Promise.all(
      (tasks ?? []).map((t) =>
        actor.db
          .from("portal_tasks")
          .update({
            start_date: t.start_date ? addDays(String(t.start_date), n) : null,
            due_date: t.due_date ? addDays(String(t.due_date), n) : null,
          })
          .eq("id", t.id),
      ),
    );
    await logActivity(actor.db, actor.workspaceId, actor.name, `moved all unfinished tasks by ${n} days`);
    refresh(actor.workspaceId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
