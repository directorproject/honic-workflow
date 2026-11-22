import type { SupabaseClient } from "@supabase/supabase-js";

import { newPublicId } from "@/lib/portal/accounts";
import { sendEmail } from "@/lib/email";
import { brandedEmail } from "@/lib/email-layout";
import { anonymousLabel, jobRefLabel } from "@/lib/portal/jobs-shared";
import { portalOrigin } from "@/lib/workspace/notify";

export type JobNotification = {
  id: string;
  publicId: string;
  title: string;
  body: string;
  href: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
};

function missing(message: string): boolean {
  return /portal_job_notifications|does not exist|schema cache/i.test(message);
}

export async function countUnreadJobNotifications(
  db: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await db
    .from("portal_job_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    if (missing(error.message)) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function listJobNotifications(
  db: SupabaseClient,
  userId: string,
  limit = 12,
): Promise<JobNotification[]> {
  const { data, error } = await db
    .from("portal_job_notifications")
    .select("id, public_id, title, body, href, kind, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (missing(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    publicId: String(row.public_id),
    title: String(row.title),
    body: String(row.body),
    href: String(row.href),
    kind: String(row.kind),
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  }));
}

export async function markJobNotificationsRead(
  db: SupabaseClient,
  userId: string,
  opts?: { jobId?: string; notificationPublicId?: string; all?: boolean },
): Promise<void> {
  let q = db
    .from("portal_job_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (opts?.notificationPublicId) q = q.eq("public_id", opts.notificationPublicId);
  else if (opts?.jobId) q = q.eq("job_id", opts.jobId);
  const { error } = await q;
  if (error && !missing(error.message)) throw new Error(error.message);
}

/** Tell the helper they were picked and money is locked. In-app + email. Never throws. */
export async function notifyHelperPicked(
  db: SupabaseClient,
  input: {
    jobId: string;
    jobPublicId: string;
    jobTitle: string;
    helperUserId: string;
    applicationId: string;
    amountTsh: number;
    payoutReady: boolean;
  },
): Promise<void> {
  try {
    const task = jobRefLabel(input.jobPublicId);
    const href = `/portal/jobs/${encodeURIComponent(input.jobPublicId)}`;
    const amount = `TSh ${Math.round(input.amountTsh).toLocaleString("en-TZ")}`;
    const title = "You were picked for a peer-help request";
    const next = input.payoutReady
      ? "Your payout number is saved. Start the work and upload a preview + final file."
      : "Set the number you'll be paid on (or use your saved payout account), then start the work.";
    const body = `${amount} is locked for “${input.jobTitle.slice(0, 80)}” (${task}). ${next}`;

    const { error } = await db.from("portal_job_notifications").insert({
      public_id: newPublicId(),
      user_id: input.helperUserId,
      job_id: input.jobId,
      application_id: input.applicationId,
      kind: "escrow",
      title,
      body,
      href,
    });
    if (error && !missing(error.message)) console.error("job notification insert:", error.message);

    const { data: auth } = await db.auth.admin.getUserById(input.helperUserId);
    const email = auth.user?.email?.trim();
    if (!email) return;
    const { data: profile } = await db
      .from("student_profiles")
      .select("full_name")
      .eq("user_id", input.helperUserId)
      .maybeSingle();
    const first = String(profile?.full_name ?? "").trim().split(/\s+/)[0] || "there";
    const origin = portalOrigin() || "https://share.honiccompany.com";
    const mail = brandedEmail({
      greeting: `Hi ${first},`,
      paragraphs: [
        `Good news: the poster picked you for “${input.jobTitle}”.`,
        `${amount} is locked in Honic escrow, so you can start with confidence.`,
        next,
      ],
      button: { label: "Open the request", url: `${origin}${href}` },
      footnote: "You received this because you offered help on Honic Nexis.",
    });
    const sent = await sendEmail({ to: email, subject: `You were picked · ${task}`, ...mail });
    if (!sent.ok) console.error("helper picked email:", sent.error);
  } catch (err) {
    console.error("notifyHelperPicked:", err);
  }
}

/** Create in-app notice + email the poster. Never throws to callers. */
export async function notifyPosterNewApplication(
  db: SupabaseClient,
  input: {
    jobId: string;
    jobPublicId: string;
    jobTitle: string;
    posterUserId: string;
    applicationId: string;
    applicantPublicId: string;
    offerSnippet: string;
  },
): Promise<void> {
  try {
    const helperLabel = anonymousLabel(input.applicantPublicId, "Helper");
    const task = jobRefLabel(input.jobPublicId);
    const href = `/portal/jobs/${encodeURIComponent(input.jobPublicId)}`;
    const title = "New offer on your peer-help request";
    const body = `${helperLabel} offered help on “${input.jobTitle.slice(0, 80)}” (${task}).`;

    const { error } = await db.from("portal_job_notifications").insert({
      public_id: newPublicId(),
      user_id: input.posterUserId,
      job_id: input.jobId,
      application_id: input.applicationId,
      kind: "application",
      title,
      body,
      href,
    });
    if (error) {
      if (!missing(error.message)) console.error("job notification insert:", error.message);
      // Still try email even if table missing? Skip if insert failed hard.
      if (missing(error.message)) {
        // table missing — email only
      } else {
        return;
      }
    }

    const { data: auth } = await db.auth.admin.getUserById(input.posterUserId);
    const email = auth.user?.email?.trim();
    if (!email) return;

    const { data: profile } = await db
      .from("student_profiles")
      .select("full_name")
      .eq("user_id", input.posterUserId)
      .maybeSingle();
    const first = String(profile?.full_name ?? "")
      .trim()
      .split(/\s+/)[0] || "there";

    const origin = portalOrigin() || "https://share.honiccompany.com";
    const mail = brandedEmail({
      greeting: `Hi ${first},`,
      paragraphs: [
        `Someone offered help on your peer-help request “${input.jobTitle}”.`,
        `${helperLabel} wrote: “${input.offerSnippet.slice(0, 240)}${input.offerSnippet.length > 240 ? "…" : ""}”`,
        "Open Peer help to chat, compare offers, and lock escrow with the helper you choose. Names stay anonymous on Nexis.",
      ],
      button: { label: "View offer", url: `${origin}${href}` },
      footnote: "You received this because you posted a peer-help request on Honic Nexis.",
    });
    const sent = await sendEmail({
      to: email,
      subject: `New peer-help offer · ${task}`,
      ...mail,
    });
    if (sent.ok && !sent.skipped) {
      await db
        .from("portal_job_notifications")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("user_id", input.posterUserId)
        .eq("application_id", input.applicationId)
        .is("email_sent_at", null);
    } else if (!sent.ok) {
      console.error("job application email:", sent.error);
    }
  } catch (err) {
    console.error("notifyPosterNewApplication:", err);
  }
}
