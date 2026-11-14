"use server";

import { requireStaffActor } from "@/lib/auth-staff";

import { revalidatePath } from "next/cache";

import { notifyLinkedStudent } from "@/lib/portal/notify";
import { createProjectShareLink } from "@/lib/project-share";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { TITLE_PROPOSAL_STATUSES, type TitleProposalStatus } from "@/lib/title-bank";

function db() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Database not configured.");
  return supabase;
}

function text(v: unknown, max = 2000): string | null {
  const s = String(v ?? "").trim().slice(0, max);
  return s.length > 0 ? s : null;
}

function requireId(v: unknown): string {
  const id = String(v ?? "").trim();
  if (!id) throw new Error("Missing id.");
  return id;
}

export async function setTitleProposalStatusAction(
  proposalId: string,
  status: TitleProposalStatus,
  assignedTo: string | null = null,
) {
  await requireStaffActor();
  const id = requireId(proposalId);
  if (!TITLE_PROPOSAL_STATUSES.includes(status)) throw new Error("Invalid status.");

  const holder = status === "reserved" || status === "assigned" ? text(assignedTo, 200) : null;
  if ((status === "reserved" || status === "assigned") && !holder) {
    throw new Error("Enter who the title is for.");
  }

  const supabase = db();
  const { data: current } = await supabase.from("title_proposals").select("selected_by").eq("id", id).maybeSingle();
  const studentId = current?.selected_by ? String(current.selected_by) : null;

  const { error } = await supabase
    .from("title_proposals")
    .update({
      status,
      assigned_to: holder,
      assigned_at: holder ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      ...(studentId ? { selected_by: null } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (studentId) {
    // Staff took the title back: record it and let the student choose again without paying.
    await supabase
      .from("title_selections")
      .update({ released_at: new Date().toISOString(), release_reason: "released_by_staff" })
      .eq("user_id", studentId)
      .eq("proposal_id", id)
      .is("released_at", null);
    const { data: prof } = await supabase.from("student_profiles").select("change_credits").eq("user_id", studentId).maybeSingle();
    if (prof) {
      await supabase
        .from("student_profiles")
        .update({ change_credits: Number(prof.change_credits ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("user_id", studentId);
    }
  }

  revalidatePath("/titles");
  revalidatePath("/portal");
}

/** Creates a tracked project from a student's selected title and links the student's portal account to it. */
export async function createProjectFromTitleAction(proposalId: string): Promise<string> {
  await requireStaffActor();
  const id = requireId(proposalId);
  const supabase = db();

  const { data: prop, error: pErr } = await supabase
    .from("title_proposals")
    .select("id, title, summary, selected_by")
    .eq("id", id)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!prop?.selected_by) throw new Error("No student has selected this title.");

  const { data: student } = await supabase
    .from("student_profiles")
    .select("user_id, full_name, phone, tracked_project_id")
    .eq("user_id", prop.selected_by)
    .maybeSingle();
  if (!student) throw new Error("The student's profile was not found.");
  if (student.tracked_project_id) return String(student.tracked_project_id);

  const clientName = String(student.full_name).trim();
  const { data: existingClient } = await supabase.from("registered_clients").select("id").eq("name", clientName).maybeSingle();
  let clientId = existingClient?.id ? String(existingClient.id) : null;
  if (!clientId) {
    const { data: created, error: cErr } = await supabase
      .from("registered_clients")
      .insert({ name: clientName, phone: student.phone ?? null })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    clientId = String(created.id);
  }

  const { data: project, error: tErr } = await supabase
    .from("tracked_projects")
    .insert({
      registered_client_id: clientId,
      title: String(prop.title),
      description: prop.summary ?? null,
      project_type: "student_fyp",
      status: "planning",
    })
    .select("id")
    .single();
  if (tErr) throw new Error(tErr.message);

  const projectId = String(project.id);
  const { error: lErr } = await supabase
    .from("student_profiles")
    .update({ tracked_project_id: projectId, linked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", student.user_id);
  if (lErr) throw new Error(lErr.message);

  await createProjectShareLink({ trackedProjectId: projectId });
  await notifyLinkedStudent({
    trackedProjectId: projectId,
    subject: "Your project has started",
    message: "Honic has started work on your project. You can follow its progress, files and updates in your portal.",
  });

  revalidatePath("/titles");
  revalidatePath("/projects");
  revalidatePath("/portal");
  return projectId;
}

export async function createCourseAction(code: string, name: string) {
  await requireStaffActor();
  const c = String(code ?? "").trim().toUpperCase();
  const n = text(name, 160);
  if (!/^[A-Z0-9]{2,12}$/.test(c)) throw new Error("Course code: 2–12 capital letters or digits, e.g. EE.");
  if (!n) throw new Error("Enter the course name.");
  const { error } = await db().from("courses").insert({ code: c, name: n, sort_order: 100 });
  if (error) {
    if (error.code === "23505") throw new Error(`Course ${c} already exists.`);
    throw new Error(error.message);
  }
  revalidatePath("/titles");
  revalidatePath("/portal");
}

export type NewTitleProposalInput = {
  title: string;
  courseCode?: string | null;
  institution?: string | null;
  originalTitle?: string | null;
  originRef?: string | null;
  summary?: string | null;
  hardware?: string | null;
  communication?: string | null;
};

export async function createTitleProposalAction(input: NewTitleProposalInput) {
  await requireStaffActor();
  const title = text(input.title, 300);
  if (!title) throw new Error("Enter the new title.");

  const { error } = await db()
    .from("title_proposals")
    .insert({
      title,
      course_code: text(input.courseCode, 12)?.toUpperCase() ?? null,
      institution: text(input.institution, 160),
      batch: "Added on dashboard",
      original_title: text(input.originalTitle, 300),
      origin_ref: text(input.originRef, 100) ?? "New idea",
      summary: text(input.summary),
      hardware: text(input.hardware),
      communication: text(input.communication),
    });
  if (error) throw new Error(error.message);

  revalidatePath("/titles");
}

/** Adds many titles at once. Blank lines are skipped. A title already in the list is skipped. */
export async function importTitleProposalsAction(inputs: NewTitleProposalInput[]) {
  await requireStaffActor();
  const rows = inputs.slice(0, 500);
  if (rows.length === 0) throw new Error("Nothing to import.");

  const supabase = db();
  const [{ data: existing, error: readError }, { data: courses, error: courseError }] = await Promise.all([
    supabase.from("title_proposals").select("title"),
    supabase.from("courses").select("code"),
  ]);
  if (readError) throw new Error(readError.message);
  if (courseError) throw new Error(courseError.message);

  const known = new Set((existing ?? []).map((row) => String(row.title ?? "").trim().toLowerCase()));
  const courseCodes = new Set((courses ?? []).map((row) => String(row.code).toUpperCase()));

  const fresh = [];
  for (const input of rows) {
    const title = text(input.title, 300);
    if (!title) continue;
    const key = title.toLowerCase();
    if (known.has(key)) continue;
    known.add(key);
    const courseCode = text(input.courseCode, 40)?.split(/[^A-Za-z0-9]/)[0]?.toUpperCase() ?? null;
    fresh.push({
      title,
      course_code: courseCode && courseCodes.has(courseCode) ? courseCode : null,
      institution: text(input.institution, 160),
      batch: "Imported on dashboard",
      original_title: text(input.originalTitle, 300),
      origin_ref: text(input.originRef, 100) ?? "Imported",
      summary: text(input.summary),
      hardware: text(input.hardware),
      communication: text(input.communication),
    });
  }
  if (fresh.length === 0) throw new Error("Every title is already in the list.");

  const { error } = await supabase.from("title_proposals").insert(fresh);
  if (error) throw new Error(error.message);
  revalidatePath("/titles");
  return fresh.length;
}

export async function deleteTitleProposalAction(proposalId: string) {
  await requireStaffActor();
  const id = requireId(proposalId);
  const { error } = await db().from("title_proposals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/titles");
}

export async function deleteLastYearProjectAction(projectId: string) {
  await requireStaffActor();
  const id = requireId(projectId);
  const { error } = await db().from("last_year_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/titles");
}
