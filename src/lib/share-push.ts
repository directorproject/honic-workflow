import { shareLinkPathClientSlug } from "@/lib/share-link-origin";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { sendWebPush } from "@/lib/web-push-server";

type PushKeys = { p256dh: string; auth: string };

export type SharePushSubscriptionInput = {
  trackedProjectId: string;
  shareToken: string;
  endpoint: string;
  keys: PushKeys;
  userAgent?: string | null;
};

export async function upsertSharePushSubscription(input: SharePushSubscriptionInput) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false as const, error: "Database not configured." };

  const { error } = await supabase.from("project_share_push_subscriptions").upsert(
    {
      tracked_project_id: input.trackedProjectId,
      share_token: input.shareToken,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      user_agent: input.userAgent ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tracked_project_id,endpoint" },
  );

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function removeSharePushSubscription(trackedProjectId: string, endpoint: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false as const, error: "Database not configured." };

  const { error } = await supabase
    .from("project_share_push_subscriptions")
    .delete()
    .eq("tracked_project_id", trackedProjectId)
    .eq("endpoint", endpoint);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function notifyShareSubscribers(params: {
  trackedProjectId: string;
  title: string;
  body: string;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const { data: rows, error } = await supabase
    .from("project_share_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("tracked_project_id", params.trackedProjectId);
  if (error || !rows?.length) return;

  const { data: projectRow } = await supabase
    .from("tracked_projects")
    .select("id, title, registered_clients ( name )")
    .eq("id", params.trackedProjectId)
    .maybeSingle();

  const client = projectRow?.registered_clients as { name?: string | null; share_subdomain?: string | null } | null;
  const slug = shareLinkPathClientSlug({
    name: client?.name?.trim() || "client",
    share_subdomain: client?.share_subdomain ?? null,
  });
  const { data: tokenRow } = await supabase
    .from("project_share_links")
    .select("token")
    .eq("tracked_project_id", params.trackedProjectId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const sharePath = tokenRow?.token ? `/share/${slug}/${tokenRow.token}` : "/";

  for (const row of rows) {
    const send = await sendWebPush(
      {
        endpoint: row.endpoint as string,
        keys: { p256dh: row.p256dh as string, auth: row.auth as string },
      },
      {
        title: params.title,
        body: params.body,
        url: sharePath,
        tag: `project-${params.trackedProjectId}`,
      },
    );

    if (!send.ok && /410|404|invalid/i.test(send.error)) {
      await supabase
        .from("project_share_push_subscriptions")
        .delete()
        .eq("tracked_project_id", params.trackedProjectId)
        .eq("endpoint", row.endpoint as string);
    }
  }
}
