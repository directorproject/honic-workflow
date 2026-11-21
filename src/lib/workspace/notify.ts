import type { SupabaseClient, User } from "@supabase/supabase-js";

import { isStaffUser } from "@/lib/auth-staff";
import { sendEmail } from "@/lib/email";
import { brandedEmail } from "@/lib/email-layout";
import { sendWebPush } from "@/lib/web-push-server";

export function portalOrigin(): string {
  return (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

/** Internal dashboard / staff host only — never fall back to the student share origin. */
export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export function portalTabUrl(tab: string): string {
  return `${portalOrigin()}/portal/home?tab=${encodeURIComponent(tab)}`;
}

export function staffWorkspaceMessagesUrl(workspaceId: string): string {
  return `${appOrigin()}/students/help-desk?c=${encodeURIComponent(workspaceId)}`;
}

async function listStaffUsers(db: SupabaseClient): Promise<User[]> {
  const staff: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const user of data.users) {
      if (isStaffUser(user)) staff.push(user);
    }
    if (data.users.length < 200) break;
  }
  return staff;
}

function opsNotifyEmails(): string[] {
  const raw = process.env.HONIC_OPS_EMAIL || process.env.HONIC_HELP_DESK_EMAIL || "portal@honiccompany.com";
  return [...new Set(raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/** Email and push Honic staff when a student writes in Help desk. Never throws. */
export async function notifyStaffHelpDesk(
  db: SupabaseClient,
  workspaceId: string,
  params: { subject: string; message: string; studentName: string },
) {
  try {
    const [{ data: ws }, staff] = await Promise.all([
      db.from("portal_workspaces").select("name").eq("id", workspaceId).maybeSingle(),
      listStaffUsers(db),
    ]);
    const project = String(ws?.name ?? "student project");
    const url = staffWorkspaceMessagesUrl(workspaceId);
    const staffIds = staff.map((u) => u.id);
    const staffEmails = new Set(staff.map((u) => u.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)));
    for (const email of opsNotifyEmails()) staffEmails.add(email);

    await Promise.all([
      sendPushToUsers(db, staffIds, {
        title: params.subject,
        body: `${params.studentName}: ${params.message}`,
        url,
        tag: `helpdesk-${workspaceId}`,
      }),
      ...[...staffEmails].map(async (email) => {
        const mail = brandedEmail({
          greeting: "Hello Honic team,",
          paragraphs: [
            `${params.studentName} sent a Help desk message on “${project}”.`,
            params.message,
          ],
          button: { label: "Open Help desk thread", url },
          footnote: "Reply in the student workspace so the team sees your answer in the portal.",
        });
        const sent = await sendEmail({ to: email, subject: params.subject, ...mail });
        if (!sent.ok) console.error("notifyStaffHelpDesk:", sent.error);
      }),
    ]);
  } catch (err) {
    console.error("notifyStaffHelpDesk:", err);
  }
}

export async function sendPushToUsers(
  db: SupabaseClient,
  userIds: string[],
  payload: { title: string; body: string; url: string; tag?: string },
) {
  if (!userIds.length) return;
  const { data: subs } = await db.from("portal_push_subscriptions").select("endpoint, p256dh, auth").in("user_id", userIds);
  await Promise.all(
    (subs ?? []).map(async (s) => {
      const res = await sendWebPush({ endpoint: String(s.endpoint), keys: { p256dh: String(s.p256dh), auth: String(s.auth) } }, payload);
      if (!res.ok && /410|404|expired|unsubscribed/i.test(res.error)) {
        await db.from("portal_push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
}

/** Email and push every member of a workspace (except one user, usually the sender). Never throws. */
export async function notifyWorkspaceMembers(
  db: SupabaseClient,
  workspaceId: string,
  params: { subject: string; message: string; tab: string; exceptUserId?: string | null },
) {
  try {
    const [{ data: ws }, { data: mem }] = await Promise.all([
      db.from("portal_workspaces").select("name").eq("id", workspaceId).maybeSingle(),
      db.from("portal_workspace_members").select("user_id").eq("workspace_id", workspaceId),
    ]);
    const ids = (mem ?? []).map((m) => String(m.user_id)).filter((id) => id !== params.exceptUserId);
    if (!ids.length) return;
    const url = portalTabUrl(params.tab);
    const project = String(ws?.name ?? "your project");

    await Promise.all([
      sendPushToUsers(db, ids, { title: params.subject, body: params.message, url, tag: `ws-${params.tab}` }),
      ...ids.map(async (id) => {
        const { data } = await db.auth.admin.getUserById(id);
        const email = data.user?.email;
        if (!email) return;
        const { data: p } = await db.from("student_profiles").select("full_name").eq("user_id", id).maybeSingle();
        const name = String(p?.full_name ?? "").split(" ")[0] || "there";
        const mail = brandedEmail({
          greeting: `Hello ${name},`,
          paragraphs: [params.message, `Project: ${project}`],
          button: { label: "Open your portal", url },
          footnote: "You get these emails because you are in a project team on the Honic student portal.",
        });
        const sent = await sendEmail({ to: email, subject: params.subject, ...mail });
        if (!sent.ok) console.error("notifyWorkspaceMembers:", sent.error);
      }),
    ]);
  } catch (err) {
    console.error("notifyWorkspaceMembers:", err);
  }
}
