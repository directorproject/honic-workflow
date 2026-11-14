import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { HelpDeskMessenger } from "@/components/workspace/help-desk-messenger";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { loadHelpDeskMessages, loadHelpDeskThreads } from "@/lib/workspace/load";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Help desk · Honic" };

export default async function StaffHelpDeskPage(props: {
  searchParams: Promise<{ c?: string }>;
}) {
  const sp = await props.searchParams;
  const db = getSupabaseAdminClient();
  const threads = db ? await loadHelpDeskThreads(db) : [];
  const selectedId =
    sp.c && threads.some((t) => t.workspaceId === sp.c)
      ? sp.c
      : threads.find((t) => t.unread > 0)?.workspaceId ?? threads[0]?.workspaceId ?? null;
  const messages = db && selectedId ? await loadHelpDeskMessages(db, selectedId) : [];
  const unread = threads.reduce((n, t) => n + t.unread, 0);

  return (
    <DashboardShell
      title="Help desk"
      subtitle="Message students in the portal like a chat app. Pick a conversation and reply here."
      statusDotClass={unread ? "bg-amber-500" : "bg-emerald-500"}
    >
      <HelpDeskMessenger threads={threads} selectedId={selectedId} messages={messages} />
    </DashboardShell>
  );
}
