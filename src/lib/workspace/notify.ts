import type { SupabaseClient } from "@supabase/supabase-js";

import { sendEmail } from "@/lib/email";
import { brandedEmail } from "@/lib/email-layout";
import { sendWebPush } from "@/lib/web-push-server";

export function portalOrigin(): string {
  return (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export function portalTabUrl(tab: string): string {
  return `${portalOrigin()}/portal?tab=${encodeURIComponent(tab)}`;
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
