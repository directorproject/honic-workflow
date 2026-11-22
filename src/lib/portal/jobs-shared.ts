/** Client-safe job types and labels (no server / next/headers imports). */

export const JOB_CATEGORIES = [
  { id: "document", label: "Write a document" },
  { id: "ppt", label: "PowerPoint / slides" },
  { id: "circuit", label: "Circuit drawing" },
  { id: "block_diagram", label: "Block diagram" },
  { id: "flowchart", label: "Flow chart" },
  { id: "layout", label: "Layout / PCB / board" },
  { id: "other", label: "Other" },
] as const;

export type JobCategoryId = (typeof JOB_CATEGORIES)[number]["id"];
export type JobPriceMode = "fixed" | "negotiable";
export type JobStatus = "open" | "assigned" | "closed" | "cancelled";
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export type PortalJob = {
  id: string;
  publicId: string;
  posterPublicId: string;
  posterLabel: string;
  category: string;
  categoryLabel: string;
  title: string;
  description: string;
  offerTsh: number;
  priceMode: JobPriceMode;
  status: JobStatus;
  createdAt: string;
  isMine: boolean;
};

export type PortalJobApplication = {
  id: string;
  publicId: string;
  jobId: string;
  /** Job public id for links (when loaded with join). */
  jobPublicId: string | null;
  applicantPublicId: string;
  applicantLabel: string;
  message: string;
  proposedTsh: number | null;
  status: ApplicationStatus;
  createdAt: string;
  isMine: boolean;
};

export type PortalJobMessage = {
  id: string;
  senderPublicId: string;
  senderLabel: string;
  body: string;
  createdAt: string;
  isMine: boolean;
};

/** One conversation in the peer-help inbox (one offer = one chat). */
export type PortalChatThread = {
  applicationPublicId: string;
  jobPublicId: string;
  jobTitle: string;
  role: "poster" | "helper";
  counterpartLabel: string;
  status: ApplicationStatus;
  offerMessage: string;
  proposedTsh: number | null;
  createdAt: string;
  lastMessage: { body: string; createdAt: string; isMine: boolean } | null;
  messageCount: number;
  /** Times of messages from the other side, newest first (unread is computed on the device). */
  incomingAt: string[];
  posterReplied: boolean;
};

export function threadActivityAt(t: PortalChatThread): string {
  return t.lastMessage?.createdAt ?? t.createdAt;
}

export function jobCategoryLabel(id: string): string {
  return JOB_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Short anonymous display id from a 64-char public id. */
export function anonymousLabel(publicId: string, role: "Poster" | "Helper" = "Poster"): string {
  const short = String(publicId).slice(0, 8).toLowerCase();
  return `${role} ${short}`;
}

export function jobRefLabel(publicId: string): string {
  return `Task ${String(publicId).slice(0, 8).toLowerCase()}`;
}
