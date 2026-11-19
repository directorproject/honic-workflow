/**
 * Honic Nexis / Nexis Desk membership (mobile money via Snippe).
 * Paid plan: up to 2 title hides free; Jobs posting & applying included.
 * Free plan: every hide costs EXTRA_TITLE_HIDE_FEE_TSH; Jobs browse only.
 * 3rd+ hide on a paid plan also costs EXTRA_TITLE_HIDE_FEE_TSH each.
 */
export const SUBSCRIPTION_YEAR_TSH = 24_000;
/** Six-month / one-semester plan (5 months worth, good 20% discount). */
export const SUBSCRIPTION_SEMESTER_TSH = 14_000;
/** Pay-as-you-go Nexis Desk — billed per calendar month at checkout. */
export const SUBSCRIPTION_MONTH_TSH = 3_000;
/** Max consecutive months purchasable in one monthly checkout. */
export const MAX_MEMBERSHIP_MONTHS = 12;

/** Free hides included with an active paid desk plan. */
export const PAID_PLAN_FREE_HIDES = 2;
/** Free hides on the free (no membership) plan — every hide is paid. */
export const FREE_PLAN_FREE_HIDES = 0;

/** @deprecated Use PAID_PLAN_FREE_HIDES — kept for older UI imports. */
export const FREE_TITLE_SLOTS = PAID_PLAN_FREE_HIDES;

/** Pay this to hide one title when no free hide remains (free plan, or 3rd+ on paid plan). */
export const EXTRA_TITLE_HIDE_FEE_TSH = 3_500;

/** How long a pending mobile-money prompt stays open before it expires (students can retry after). */
export const PENDING_PAYMENT_TTL_MS = 15 * 60 * 1000;

/**
 * Unlock published documents on literature / earlier projects (study files, not a finished FYP for sale).
 */
export const PROJECT_DOCUMENTS_ACCESS_TSH = 25_000;

/**
 * Workspace file storage by plan (Project files page).
 * Free: enough for a proposal PDF, a few minutes decks, and light images.
 * Paid Nexis Desk: room for full report versions, PPT, CAD, and photos through the project cycle.
 */
export const FREE_PLAN_FILE_STORAGE_BYTES = 250 * 1024 * 1024; // 250 MB
export const PAID_PLAN_FILE_STORAGE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export function formatStorageQuota(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    const gb = bytes / (1024 * 1024 * 1024);
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  const mb = Math.round(bytes / (1024 * 1024));
  return `${mb} MB`;
}

/**
 * Legacy: fee to release a held title and pick a replacement.
 * Prefer EXTRA_TITLE_HIDE_FEE_TSH for new “extra hide” purchases.
 */
export const TITLE_CHANGE_FEE_TSH = EXTRA_TITLE_HIDE_FEE_TSH;

/** Legacy alias kept so older copy still compiles. */
export const TITLE_SELECT_FEE_TSH = EXTRA_TITLE_HIDE_FEE_TSH;

/** Live mobile-money provider. Set SNIPPE_API_KEY; webhook confirms payment. */
export const PAYMENT_PROVIDER = "snippe" as const;

export const PAYMENT_NETWORKS = ["M-Pesa", "Mixx by Yas (Tigo Pesa)", "Airtel Money", "HaloPesa"] as const;

export const YEARS_OF_STUDY = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"] as const;

export const STUDY_LEVELS = [
  { value: "ordinary_diploma", label: "Ordinary Diploma" },
  { value: "bachelor", label: "Bachelor's degree" },
  { value: "masters", label: "Master's degree" },
  { value: "other", label: "Other" },
] as const;

export type StudyLevel = (typeof STUDY_LEVELS)[number]["value"];

export const PROJECT_CATEGORIES = [
  { value: "fyp", label: "Final Year Project (FYP)" },
  { value: "research", label: "Research project" },
  { value: "innovation", label: "Innovation project" },
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]["value"];

export function studyLevelLabel(level: string | null, levelOther?: string | null): string | null {
  if (!level) return null;
  if (level === "other") return levelOther?.trim() || "Other";
  return STUDY_LEVELS.find((l) => l.value === level)?.label ?? null;
}

export function projectCategoryLabel(category: string | null): string | null {
  return PROJECT_CATEGORIES.find((c) => c.value === category)?.label ?? null;
}

export const DEFAULT_INSTITUTION = "Dar es Salaam Institute of Technology (DIT)";

/** Select value meaning "the student types the value"; never stored. */
export const OTHER_OPTION = "__other__";

/** Course code used when the student types a course that is not in the list. */
export const OTHER_COURSE_CODE = "OTHER";

/** Tanzanian universities and colleges whose students do project and research work. */
export const INSTITUTIONS = [
  "Dar es Salaam Institute of Technology (DIT)",
  "University of Dar es Salaam (UDSM)",
  "Ardhi University (ARU)",
  "Arusha Technical College (ATC)",
  "Catholic University of Health and Allied Sciences (CUHAS)",
  "College of Business Education (CBE)",
  "Dar es Salaam Maritime Institute (DMI)",
  "Dar es Salaam University College of Education (DUCE)",
  "Institute of Accountancy Arusha (IAA)",
  "Institute of Finance Management (IFM)",
  "Institute of Rural Development Planning (IRDP)",
  "Institute of Social Work (ISW)",
  "Kampala International University in Tanzania (KIUT)",
  "Karume Institute of Science and Technology (KIST)",
  "Kilimanjaro Christian Medical University College (KCMUCo)",
  "Mbeya University of Science and Technology (MUST)",
  "Mkwawa University College of Education (MUCE)",
  "Moshi Co-operative University (MoCU)",
  "Mount Meru University (MMU)",
  "Muhimbili University of Health and Allied Sciences (MUHAS)",
  "Mwalimu Nyerere Memorial Academy (MNMA)",
  "Mzumbe University (MU)",
  "National Institute of Transport (NIT)",
  "Nelson Mandela African Institution of Science and Technology (NM-AIST)",
  "Open University of Tanzania (OUT)",
  "Ruaha Catholic University (RUCU)",
  "Sokoine University of Agriculture (SUA)",
  "St. Augustine University of Tanzania (SAUT)",
  "St. Joseph University in Tanzania (SJUIT)",
  "State University of Zanzibar (SUZA)",
  "Tanzania Institute of Accountancy (TIA)",
  "Tumaini University Makumira (TUMA)",
  "University of Dodoma (UDOM)",
  "University of Iringa (UoI)",
  "Vocational Education and Training Authority (VETA)",
  "Water Institute (WI)",
] as const;
