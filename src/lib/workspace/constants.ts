export const TASK_STATUSES = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
] as const;

export const TASK_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
] as const;

export const PHASE_COLORS = ["sky", "violet", "amber", "emerald", "rose", "cyan", "orange", "lime"] as const;

/** Tailwind classes per phase colour (bar, soft background, text). */
export const PHASE_COLOR_CLASSES: Record<string, { bar: string; soft: string; text: string }> = {
  sky: { bar: "bg-sky-500", soft: "bg-sky-500/15", text: "text-sky-700 dark:text-sky-300" },
  violet: { bar: "bg-violet-500", soft: "bg-violet-500/15", text: "text-violet-700 dark:text-violet-300" },
  amber: { bar: "bg-amber-500", soft: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300" },
  emerald: { bar: "bg-emerald-500", soft: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300" },
  rose: { bar: "bg-rose-500", soft: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-300" },
  cyan: { bar: "bg-cyan-500", soft: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-300" },
  orange: { bar: "bg-orange-500", soft: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300" },
  lime: { bar: "bg-lime-500", soft: "bg-lime-500/15", text: "text-lime-700 dark:text-lime-300" },
};

export function phaseColor(color: string | null | undefined) {
  return PHASE_COLOR_CLASSES[color ?? ""] ?? PHASE_COLOR_CLASSES.sky;
}

export const EVENT_KINDS = [
  { value: "meeting", label: "Supervisor meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "presentation", label: "Presentation" },
  { value: "other", label: "Other" },
] as const;

export const DOCUMENT_STATUSES = [
  { value: "not_started", label: "Not started", tone: "bg-slate-500/15 text-dash-muted-foreground" },
  { value: "draft", label: "Draft", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { value: "submitted", label: "Sent to supervisor", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { value: "changes", label: "Needs changes", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "approved", label: "Approved", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
] as const;

export const FILE_FOLDERS = ["General", "Code", "Circuits and designs", "Photos and videos", "Datasheets", "Reports", "Results"];

export const PART_STATUSES = [
  { value: "needed", label: "Needed", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "ordered", label: "Ordered", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { value: "bought", label: "Bought", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
] as const;

export const REFERENCE_KINDS = [
  { value: "article", label: "Journal or conference article" },
  { value: "book", label: "Book" },
  { value: "website", label: "Website" },
  { value: "datasheet", label: "Datasheet" },
  { value: "thesis", label: "Thesis or project report" },
  { value: "other", label: "Other" },
] as const;

export const BOOKING_KINDS = [
  { value: "meeting", label: "Meeting at Honic" },
  { value: "lab", label: "Lab or workshop time" },
  { value: "online", label: "Online call" },
] as const;

export const BOOKING_STATUSES = [
  { value: "requested", label: "Waiting for Honic", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "confirmed", label: "Confirmed", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "declined", label: "Declined", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  { value: "cancelled", label: "Cancelled", tone: "bg-slate-500/15 text-dash-muted-foreground" },
  { value: "done", label: "Done", tone: "bg-slate-500/15 text-dash-muted-foreground" },
] as const;

export const INVOICE_STATUSES = [
  { value: "quote", label: "Quote", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { value: "unpaid", label: "Unpaid", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { value: "paid", label: "Paid", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "cancelled", label: "Cancelled", tone: "bg-slate-500/15 text-dash-muted-foreground" },
] as const;

export function tone<T extends { value: string; label: string; tone: string }>(list: readonly T[], value: string) {
  return list.find((x) => x.value === value) ?? list[0];
}

export function labelOf(list: readonly { value: string; label: string }[], value: string | null | undefined): string {
  return list.find((x) => x.value === value)?.label ?? value ?? "";
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const STORAGE_BUCKET = "portal-files";

export function formatTsh(n: number): string {
  return `TSh ${Math.round(n).toLocaleString("en-US")}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
