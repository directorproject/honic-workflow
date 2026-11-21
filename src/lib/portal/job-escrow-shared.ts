/** Client-safe peer-help escrow types and labels. */

export const ESCROW_REVIEW_HOURS = 48;
export const ESCROW_PREVIEW_MAX_BYTES = 8 * 1024 * 1024;
export const ESCROW_FINAL_MAX_BYTES = 25 * 1024 * 1024;
export const ESCROW_PREVIEW_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const ESCROW_FINAL_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type EscrowStatus =
  | "awaiting_funds"
  | "locked"
  | "delivered"
  | "disputed"
  | "released"
  | "refunded"
  | "cancelled";

export type DeliverableKind = "preview" | "final";

export type JobPayoutStatus = "queued" | "processing" | "paid" | "failed" | "cancelled";

export type PortalJobEscrow = {
  id: string;
  publicId: string;
  jobId: string;
  applicationId: string;
  amountTsh: number;
  status: EscrowStatus;
  paymentReference: string | null;
  lockedAt: string | null;
  deliveredAt: string | null;
  reviewDeadlineAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  disputeReason: string | null;
  disputeOpenedAt: string | null;
  isPoster: boolean;
  isHelper: boolean;
};

export type PortalJobDeliverableMeta = {
  id: string;
  publicId: string;
  kind: DeliverableKind;
  mimeType: string;
  byteSize: number;
  originalName: string;
  createdAt: string;
};

export function escrowStatusLabel(status: EscrowStatus): string {
  switch (status) {
    case "awaiting_funds":
      return "Awaiting escrow payment";
    case "locked":
      return "Funds locked · work in progress";
    case "delivered":
      return "Delivered · review window open";
    case "disputed":
      return "Disputed · Honic reviewing";
    case "released":
      return "Released · helper payout queued";
    case "refunded":
      return "Refunded to poster";
    case "cancelled":
      return "Escrow cancelled";
    default:
      return status;
  }
}
