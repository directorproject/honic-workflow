"use server";

import { revalidatePath } from "next/cache";

import { isStaffUser, requireStaffActor } from "@/lib/auth-staff";
import { notifyLinkedStudent } from "@/lib/portal/notify";
import { createProjectShareLink } from "@/lib/project-share";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";

function db() {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("Secure database access is not configured.");
  return supabase;
}

async function findUserIdByEmail(email: string) {
  const supabase = db();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function linkStudentAccountAction(projectId: string, email: string) {
  await requireStaffActor();
  const id = String(projectId ?? "").trim();
  const e = String(email ?? "").trim().toLowerCase();
  if (!id) throw new Error("Missing project id.");
  if (!e.includes("@")) throw new Error("Enter the student's email address.");

  const user = await findUserIdByEmail(e);
  if (!user) throw new Error("No portal account uses this email. Ask the student to sign up on share.honiccompany.com/portal.");
  if (isStaffUser(user)) throw new Error("That is a staff account, not a student account.");

  const supabase = db();
  const { data: profile } = await supabase
    .from("student_profiles")
    .select("user_id, tracked_project_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) throw new Error("This student has not filled in their portal details yet.");
  if (profile.tracked_project_id && String(profile.tracked_project_id) !== id) {
    throw new Error("This student is already linked to another project. Unlink it there first.");
  }

  const { data: current } = await supabase.from("student_profiles").select("user_id").eq("tracked_project_id", id).maybeSingle();
  if (current && String(current.user_id) !== user.id) {
    throw new Error("Another student is linked to this project. Unlink them first.");
  }

  const { error } = await supabase
    .from("student_profiles")
    .update({ tracked_project_id: id, linked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await createProjectShareLink({ trackedProjectId: id });
  await notifyLinkedStudent({
    trackedProjectId: id,
    subject: "Your project has started",
    message: "Honic has started work on your project. You can follow its progress, files and updates in your portal.",
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath("/titles");
  revalidatePath("/portal");
}

export async function unlinkStudentAccountAction(projectId: string) {
  await requireStaffActor();
  const id = String(projectId ?? "").trim();
  if (!id) throw new Error("Missing project id.");
  const { error } = await db()
    .from("student_profiles")
    .update({ tracked_project_id: null, linked_at: null, updated_at: new Date().toISOString() })
    .eq("tracked_project_id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/titles");
  revalidatePath("/portal");
}
