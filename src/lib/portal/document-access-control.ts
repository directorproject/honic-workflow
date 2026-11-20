import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccessLimits, mapDeskPlanToAccessPlan, type DocumentAccessPlan } from "./document-access-config";

/**
 * Get user's document access level based on their plan.
 */
export async function getUserDocumentAccessPlan(
  userId: string,
  deskPlan: string | null
): Promise<DocumentAccessPlan> {
  return mapDeskPlanToAccessPlan(deskPlan);
}

/**
 * Check if user can view a document.
 */
export async function canUserViewDocument(db: SupabaseClient, userId: string, documentId: string, deskPlan: string | null): Promise<boolean> {
  const plan = await getUserDocumentAccessPlan(userId, deskPlan);

  if (plan === "free") {
    // Free users can always view but can't download
    return true;
  }

  // For paid plans, check view limit
  const { count } = await db
    .from("user_document_access")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("accessed_at", new Date().toISOString().split("T")[0]);

  const limits = getAccessLimits(plan);
  return (count || 0) < limits.viewLimit;
}

/**
 * Check if user can download a document.
 */
export async function canUserDownload(
  db: SupabaseClient,
  userId: string,
  documentId: string,
  deskPlan: string | null
): Promise<{ allowed: boolean; reason?: string }> {
  const plan = await getUserDocumentAccessPlan(userId, deskPlan);
  const limits = getAccessLimits(plan);

  if (limits.downloadLimit === 0) {
    return {
      allowed: false,
      reason: "Free plan cannot download documents. Upgrade to a paid plan or pay per document.",
    };
  }

  // Check this month's downloads
  const thisMonth = new Date();
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString();

  const { count } = await db
    .from("user_document_access")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("downloaded_at", monthStart)
    .not("downloaded_at", "is", null);

  if ((count || 0) >= limits.downloadLimit) {
    return {
      allowed: false,
      reason: `You've used your ${limits.downloadLimit} monthly download${limits.downloadLimit === 1 ? "" : "s"}. Try again next month or upgrade your plan.`,
    };
  }

  return { allowed: true };
}

/**
 * Record document access when user views it.
 */
export async function recordDocumentAccess(db: SupabaseClient, userId: string, documentId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await db
    .from("user_document_access")
    .select("id, view_count")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .gte("accessed_at", `${today}T00:00:00`)
    .lt("accessed_at", `${today}T23:59:59`)
    .maybeSingle();

  if (existing) {
    await db
      .from("user_document_access")
      .update({ view_count: (existing.view_count || 1) + 1 })
      .eq("id", existing.id);
  } else {
    await db.from("user_document_access").insert({
      user_id: userId,
      document_id: documentId,
      view_count: 1,
    });
  }
}

/**
 * Record document download.
 */
export async function recordDocumentDownload(db: SupabaseClient, userId: string, documentId: string): Promise<void> {
  const { data: existing } = await db
    .from("user_document_access")
    .select("id, download_count")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .maybeSingle();

  if (existing) {
    await db
      .from("user_document_access")
      .update({
        download_count: (existing.download_count || 0) + 1,
        downloaded_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await db.from("user_document_access").insert({
      user_id: userId,
      document_id: documentId,
      download_count: 1,
      downloaded_at: new Date().toISOString(),
    });
  }
}

/**
 * Get user's current month download count.
 */
export async function getUserMonthlyDownloadCount(db: SupabaseClient, userId: string): Promise<number> {
  const thisMonth = new Date();
  const monthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1).toISOString();

  const { data, error } = await db
    .from("user_document_access")
    .select("download_count")
    .eq("user_id", userId)
    .gte("downloaded_at", monthStart)
    .not("downloaded_at", "is", null);

  if (error) return 0;
  return (data || []).reduce((sum, row) => sum + (row.download_count || 0), 0);
}

/**
 * Get access summary for user (for UI display).
 */
export async function getAccessSummary(
  db: SupabaseClient,
  userId: string,
  deskPlan: string | null
): Promise<{ plan: DocumentAccessPlan; limits: ReturnType<typeof getAccessLimits>; monthlyDownloads: number }> {
  const plan = await getUserDocumentAccessPlan(userId, deskPlan);
  const limits = getAccessLimits(plan);
  const monthlyDownloads = await getUserMonthlyDownloadCount(db, userId);

  return { plan, limits, monthlyDownloads };
}
