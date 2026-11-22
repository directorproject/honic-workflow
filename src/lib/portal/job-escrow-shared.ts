/** Client-safe peer-help escrow types and labels. */

export const ESCROW_REVIEW_HOURS = 48;
/** Helper must deliver preview + final within this window after funds lock, or poster is auto-refunded. */
export const ESCROW_DELIVERY_HOURS = 72;
export const ESCROW_REVISION_EXTRA_HOURS = 48;
export const ESCROW_MAX_REVISIONS = 2;
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
  /** Money held by Honic, no helper picked yet. */
  | "funded"
  | "locked"
  | "delivered"
  | "disputed"
  | "released"
  | "refunded"
  | "cancelled";

export type DeliverableKind = "preview" | "final";

export type JobPayoutStatus = "queued" | "processing" | "paid" | "failed" | "cancelled";

export type EscrowActorRole = "poster" | "helper" | "staff" | "system";

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
  deliveryDeadlineAt: string | null;
  reviewDeadlineAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  disputeReason: string | null;
  disputeOpenedAt: string | null;
  revisionNote: string | null;
  revisionRequestedAt: string | null;
  revisionCount: number;
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

export type PortalJobEscrowEvent = {
  publicId: string;
  eventType: string;
  actorRole: EscrowActorRole;
  message: string;
  createdAt: string;
};

export type StaffEscrowQueueItem = {
  escrowPublicId: string;
  jobPublicId: string;
  jobTitle: string;
  amountTsh: number;
  status: EscrowStatus;
  disputeReason: string | null;
  updatedAt: string;
  href: string;
};

export type StaffPayoutQueueItem = {
  payoutPublicId: string;
  escrowPublicId: string;
  jobPublicId: string;
  amountTsh: number;
  status: JobPayoutStatus;
  network: string | null;
  phone: string | null;
  accountName: string | null;
  updatedAt: string;
  href: string;
};

export type PeerHelpStepKey = "fund" | "work" | "upload" | "check" | "done";

export type PeerHelpStep = {
  key: PeerHelpStepKey;
  label: string;
  detail: string;
  state: "done" | "current" | "upcoming" | "blocked";
};

export function escrowStatusLabel(status: EscrowStatus): string {
  switch (status) {
    case "awaiting_funds":
      return "Awaiting escrow payment";
    case "funded":
      return "Money locked · pick a helper";
    case "locked":
      return "Funds locked · work in progress";
    case "delivered":
      return "Delivered · poster check open";
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

/** Shared activity steps for poster + helper (upload → poster check → release). */
export function peerHelpActivitySteps(
  escrow: PortalJobEscrow,
  deliverables: PortalJobDeliverableMeta[],
): PeerHelpStep[] {
  const hasPreview = deliverables.some((d) => d.kind === "preview");
  const hasFinal = deliverables.some((d) => d.kind === "final");
  const uploaded = hasPreview && hasFinal;
  const status = escrow.status;
  const terminal = status === "released" || status === "refunded" || status === "cancelled";
  const disputed = status === "disputed";

  const fundState: PeerHelpStep["state"] =
    status === "awaiting_funds" ? "current" : "done";
  const workState: PeerHelpStep["state"] =
    status === "awaiting_funds" || status === "funded"
      ? "upcoming"
      : status === "locked" && !uploaded
        ? "current"
        : status === "locked" || status === "delivered" || disputed || terminal
          ? "done"
          : "upcoming";
  const uploadState: PeerHelpStep["state"] =
    status === "awaiting_funds" || status === "funded"
      ? "upcoming"
      : status === "locked" && !uploaded
        ? "current"
        : uploaded || status === "delivered" || disputed || terminal
          ? "done"
          : "upcoming";
  const checkState: PeerHelpStep["state"] =
    terminal
      ? "done"
      : disputed
        ? "blocked"
        : status === "delivered"
          ? "current"
          : "upcoming";
  const doneState: PeerHelpStep["state"] = terminal ? "done" : "upcoming";

  return [
    {
      key: "fund",
      label: "Lock escrow",
      detail: fundState === "current" ? "Poster pays mobile money to lock funds" : "Funds secured",
      state: fundState,
    },
    {
      key: "work",
      label: "Helper works",
      detail:
        status === "funded"
          ? "Pick a helper in Chats to start"
          : escrow.revisionNote && status === "locked"
          ? `Revision requested: ${escrow.revisionNote}`
          : workState === "current"
            ? "Helper prepares the deliverable"
            : "In progress or done",
      state: workState,
    },
    {
      key: "upload",
      label: "Upload files",
      detail: uploaded
        ? "Preview + final on file"
        : hasPreview
          ? "Preview in — final still needed"
          : hasFinal
            ? "Final in — preview still needed"
            : "Preview image + final file",
      state: uploadState,
    },
    {
      key: "check",
      label: "Poster check",
      detail: disputed
        ? "Dispute open — Honic decides"
        : status === "delivered"
          ? "Review watermarked preview"
          : "Opens after both files upload",
      state: checkState,
    },
    {
      key: "done",
      label: status === "refunded" ? "Refunded" : "Release / payout",
      detail:
        status === "released"
          ? "Final unlocked · helper payout queued"
          : status === "refunded"
            ? "Poster refunded"
            : "Confirm, auto-release, or staff decision",
      state: doneState,
    },
  ];
}
