/**
 * Must stay in sync with `tracked_projects.status` check constraint (see supabase/006_project_tracking.sql).
 * Folder names under the project Drive folder use `label` when sorting uploads by status.
 */
export const PROJECT_STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "prototype_phase", label: "Prototype phase" },
  { value: "testing", label: "Testing" },
  { value: "on_hold", label: "On hold" },
  { value: "client_side", label: "Client side" },
  { value: "completed", label: "Completed" },
] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number]["value"];

export function projectStatusUploadFolderLabel(value: string): string {
  const row = PROJECT_STATUSES.find((s) => s.value === value);
  return row?.label ?? value.replace(/_/g, " ");
}

/**
 * Must stay in sync with `tracked_projects.project_type` check constraint (see supabase/008_project_types.sql).
 */
export const PROJECT_TYPES = [
  { value: "student_fyp", label: "Student final year project (FYP)" },
  { value: "research", label: "Research project" },
  { value: "product_prototype", label: "Product prototype" },
  { value: "product", label: "Product / production" },
  { value: "mvp", label: "MVP (minimum viable product)" },
  { value: "other", label: "Other" },
] as const;

export type ProjectTypeValue = (typeof PROJECT_TYPES)[number]["value"];

const LABEL_BY_VALUE = Object.fromEntries(PROJECT_TYPES.map((p) => [p.value, p.label])) as Record<
  ProjectTypeValue,
  string
>;

/** Shorter labels for narrow screens (one-row meta chips). */
const COMPACT_TYPE_LABEL: Partial<Record<ProjectTypeValue, string>> = {
  student_fyp: "Final year project",
  research: "Research",
  product_prototype: "Prototype",
  product: "Product",
  mvp: "MVP",
  other: "Other",
};

export type FormatProjectTypeOptions = {
  /** Shorter type text on phones (e.g. FYP → "Final year project"). */
  compact?: boolean;
};

/** Human-readable label for tables and detail pages. */
export function formatProjectType(
  value: string | null | undefined,
  options?: FormatProjectTypeOptions,
): string {
  if (!value) return "—";
  if (value in LABEL_BY_VALUE) {
    const key = value as ProjectTypeValue;
    if (options?.compact && COMPACT_TYPE_LABEL[key]) {
      return COMPACT_TYPE_LABEL[key]!;
    }
    return LABEL_BY_VALUE[key];
  }
  /* Legacy DB values before migration */
  if (value === "student_final") {
    return options?.compact ? "Final year project" : "Student final year project (FYP) (legacy)";
  }
  if (value === "prototype") {
    return options?.compact ? "Prototype" : "Product prototype (legacy)";
  }
  return value.replace(/_/g, " ");
}
