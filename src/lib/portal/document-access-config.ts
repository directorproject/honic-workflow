/**
 * Document access control configuration by plan.
 * Defines view/download limits and security restrictions per plan tier.
 */

export type DocumentAccessPlan = "free" | "monthly" | "semester" | "year";

export interface DocumentAccessLimits {
  plan: DocumentAccessPlan;
  viewLimit: number; // Max documents user can view
  downloadLimit: number; // Max documents user can download
  canPrint: boolean; // Can user print documents
  canScreenshot: boolean; // Can user take screenshots
  monthlyDownloadQuota?: number; // Monthly downloads allowed (optional rolling limit)
}

export const DOCUMENT_ACCESS_LIMITS: Record<DocumentAccessPlan, DocumentAccessLimits> = {
  free: {
    plan: "free",
    viewLimit: 999, // Can view many but can't download
    downloadLimit: 0, // No downloads, must pay per document
    canPrint: false,
    canScreenshot: false,
  },
  monthly: {
    plan: "monthly",
    viewLimit: 3,
    downloadLimit: 3,
    canPrint: false,
    canScreenshot: false,
  },
  semester: {
    plan: "semester",
    viewLimit: 5,
    downloadLimit: 5,
    canPrint: false,
    canScreenshot: false,
  },
  year: {
    plan: "year",
    viewLimit: 10,
    downloadLimit: 10,
    canPrint: false,
    canScreenshot: false,
  },
};

/**
 * Get access limits for a plan.
 */
export function getAccessLimits(plan: DocumentAccessPlan): DocumentAccessLimits {
  return DOCUMENT_ACCESS_LIMITS[plan] || DOCUMENT_ACCESS_LIMITS.free;
}

/**
 * Map desk plan to document access plan.
 */
export function mapDeskPlanToAccessPlan(deskPlan: string | null): DocumentAccessPlan {
  if (!deskPlan) return "free";
  if (deskPlan === "monthly") return "monthly";
  if (deskPlan === "semester") return "semester";
  if (deskPlan === "year") return "year";
  return "free";
}

/**
 * Check if user can download based on limits.
 */
export function canUserDownloadDocument(
  plan: DocumentAccessPlan,
  currentDownloads: number,
  monthlyQuota?: number
): boolean {
  const limits = getAccessLimits(plan);
  if (limits.downloadLimit === 0) return false; // Free plan can't download
  if (currentDownloads >= limits.downloadLimit) return false; // Hit monthly limit
  if (monthlyQuota !== undefined && monthlyQuota >= (limits.monthlyDownloadQuota || limits.downloadLimit)) {
    return false; // Hit rolling quota
  }
  return true;
}

/**
 * Security options for PDF viewer based on plan.
 */
export function getPDFSecurityOptions(plan: DocumentAccessPlan) {
  const limits = getAccessLimits(plan);
  return {
    disableCopy: true, // Always disable copy
    disablePrint: !limits.canPrint,
    disableScreenshot: !limits.canScreenshot,
    disableDownload: limits.downloadLimit === 0,
    watermark: `Plan: ${plan.toUpperCase()} | ${new Date().toISOString().split("T")[0]}`,
  };
}
