export const TITLE_CHANGE_FEE_TSH = 10000;

/** Payments are simulated until a mobile-money provider (for example AzamPay) is connected. */
export const PAYMENT_PROVIDER = "simulated";

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
