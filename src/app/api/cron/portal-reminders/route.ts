import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { addDays, formatDate, todayIso } from "@/lib/workspace/dates";
import { notifyWorkspaceMembers } from "@/lib/workspace/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Line = { workspaceId: string; text: string };

/**
 * Daily digest (Vercel cron, 07:00 EAT): tasks due today or tomorrow, events, confirmed sessions,
 * shared deadlines in the next 3 days, and on Mondays the late tasks. Sent once per workspace per day.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const today = todayIso();
  const tomorrow = addDays(today, 1);
  const monday = new Date(`${today}T12:00:00Z`).getUTCDay() === 1;
  const lines: Line[] = [];
  const push = (workspaceId: unknown, text: string) => lines.push({ workspaceId: String(workspaceId), text });

  const [{ data: ws }, { data: soon }, { data: late }, { data: events }, { data: bookings }, { data: deadlines }, { data: members }, { data: profiles }] =
    await Promise.all([
      db.from("portal_workspaces").select("id, last_digest_on, project_category"),
      db.from("portal_tasks").select("workspace_id, title, due_date").neq("status", "done").gte("due_date", today).lte("due_date", tomorrow),
      monday
        ? db.from("portal_tasks").select("workspace_id, title, due_date").neq("status", "done").lt("due_date", today)
        : Promise.resolve({ data: [] as { workspace_id: string; title: string; due_date: string }[] }),
      db.from("portal_events").select("workspace_id, title, starts_on, start_time").gte("starts_on", today).lte("starts_on", tomorrow),
      db
        .from("portal_bookings")
        .select("workspace_id, topic, confirmed_at")
        .eq("status", "confirmed")
        .gte("confirmed_at", new Date().toISOString())
        .lte("confirmed_at", new Date(Date.now() + 36 * 3600_000).toISOString()),
      db.from("portal_deadlines").select("title, due_date, institution, course_code, project_category").gte("due_date", today).lte("due_date", addDays(today, 3)),
      db.from("portal_workspace_members").select("workspace_id, user_id"),
      db.from("student_profiles").select("user_id, institution, course_code"),
    ]);

  for (const t of soon ?? []) push(t.workspace_id, `Task due ${t.due_date === today ? "today" : "tomorrow"}: ${t.title}`);
  for (const e of events ?? []) {
    push(e.workspace_id, `${e.starts_on === today ? "Today" : "Tomorrow"}${e.start_time ? ` at ${String(e.start_time).slice(0, 5)}` : ""}: ${e.title}`);
  }
  for (const b of bookings ?? []) {
    const when = new Date(String(b.confirmed_at)).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dar_es_Salaam" });
    push(b.workspace_id, `Honic session ${when}: ${b.topic}`);
  }
  const lateCount = new Map<string, number>();
  for (const t of late ?? []) lateCount.set(String(t.workspace_id), (lateCount.get(String(t.workspace_id)) ?? 0) + 1);
  for (const w of ws ?? []) {
    const ids = (members ?? []).filter((m) => m.workspace_id === w.id).map((m) => m.user_id);
    const profs = (profiles ?? []).filter((p) => ids.includes(p.user_id));
    for (const d of deadlines ?? []) {
      const matches =
        (!d.institution || profs.some((p) => String(p.institution).toLowerCase() === String(d.institution).toLowerCase())) &&
        (!d.course_code || profs.some((p) => p.course_code === d.course_code)) &&
        (!d.project_category || d.project_category === w.project_category);
      if (matches) push(w.id, `University deadline ${formatDate(d.due_date, { weekday: "short", year: undefined })}: ${d.title}`);
    }
    const n = lateCount.get(String(w.id));
    if (n) push(w.id, `${n} task${n === 1 ? " is" : "s are"} late. Open Home and use Fix my schedule to catch up.`);
  }

  let sent = 0;
  for (const w of ws ?? []) {
    if (w.last_digest_on === today) continue;
    const mine = lines.filter((l) => l.workspaceId === String(w.id)).map((l) => `• ${l.text}`);
    if (!mine.length) continue;
    await notifyWorkspaceMembers(db, String(w.id), {
      subject: "Your project today",
      message: mine.slice(0, 12).join("\n"),
      tab: "home",
    });
    await db.from("portal_workspaces").update({ last_digest_on: today }).eq("id", w.id);
    sent++;
  }
  return NextResponse.json({ ok: true, sent });
}
