import { escapeHtml, sendEmail } from "@/lib/email";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

function portalUrl(): string {
  const origin = (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${origin}/portal?tab=progress`;
}

/** Emails the student whose portal account is linked to this project. Never throws. */
export async function notifyLinkedStudent(params: { trackedProjectId: string; subject: string; message: string }) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;

    const { data: profile } = await supabase
      .from("student_profiles")
      .select("user_id, full_name")
      .eq("tracked_project_id", params.trackedProjectId)
      .maybeSingle();
    if (!profile?.user_id) return;

    const { data: userRes } = await supabase.auth.admin.getUserById(String(profile.user_id));
    const email = userRes?.user?.email;
    if (!email) return;

    const { data: project } = await supabase
      .from("tracked_projects")
      .select("title")
      .eq("id", params.trackedProjectId)
      .maybeSingle();
    const title = String(project?.title ?? "your project");
    const name = String(profile.full_name ?? "").split(" ")[0] || "there";
    const link = portalUrl();

    const text = `Hello ${name},\n\n${params.message}\n\nProject: ${title}\nOpen your portal: ${link}\n\nHonic Company Limited · Innovation and Research Department`;
    const html = `<p>Hello ${escapeHtml(name)},</p><p>${escapeHtml(params.message)}</p><p><strong>Project:</strong> ${escapeHtml(title)}</p><p><a href="${escapeHtml(link)}">Open your portal</a></p><p style="color:#64748b">Honic Company Limited · Innovation and Research Department</p>`;

    const sent = await sendEmail({ to: email, subject: params.subject, text, html });
    if (!sent.ok) console.error("notifyLinkedStudent:", sent.error);
  } catch (err) {
    console.error("notifyLinkedStudent:", err);
  }
}
