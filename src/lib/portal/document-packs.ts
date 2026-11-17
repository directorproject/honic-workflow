import {
  EXTRA_TITLE_HIDE_FEE_TSH,
  FREE_PLAN_FILE_STORAGE_BYTES,
  FREE_TITLE_SLOTS,
  PAID_PLAN_FILE_STORAGE_BYTES,
  PROJECT_DOCUMENTS_ACCESS_TSH,
  SUBSCRIPTION_MONTH_TSH,
  SUBSCRIPTION_SEMESTER_TSH,
  SUBSCRIPTION_YEAR_TSH,
  formatStorageQuota,
} from "@/lib/portal/config";

/** Share of premium writing-pack sales paid to the preparer (when those packs are sold separately). */
export const PACK_PREPARER_SHARE = 0.6;

export type DocumentPack = {
  id: string;
  name: string;
  priceTsh: number;
  summary: string;
  includes: string[];
  preview: string;
  preparer: string;
  level: "starter" | "writing" | "defence" | "bundle";
};

/**
 * Optional writing guides (still not a finished project).
 * Core money model is membership + title hides + project-document access — see PRICING_BOARD.
 */
export const DOCUMENT_PACKS: DocumentPack[] = [
  {
    id: "starter-proposal",
    name: "Proposal starter pack",
    priceTsh: 15_000,
    level: "starter",
    preparer: "Honic writing desk",
    summary: "Optional add-on: proposal outline prompts you complete yourself.",
    preview: "Structure for problem → objectives → method (you fill the content).",
    includes: ["Proposal outline with prompts", "Problem checklist", "Work-plan table"],
  },
  {
    id: "chapter-guides",
    name: "Chapter writing guides",
    priceTsh: 25_000,
    level: "writing",
    preparer: "Honic writing desk",
    summary: "Optional add-on: chapter maps and checklists. You still write your own chapters.",
    preview: "Chapter 1 to 3 map with “what good looks like” notes.",
    includes: ["Chapter maps", "Mistakes list", "Reference sheet"],
  },
];

export function formatTsh(amount: number): string {
  return `TSh ${amount.toLocaleString("en-TZ")}`;
}

export function preparerPayoutTsh(priceTsh: number): number {
  return Math.round(priceTsh * PACK_PREPARER_SHARE);
}

export function honicShareTsh(priceTsh: number): number {
  return priceTsh - preparerPayoutTsh(priceTsh);
}

/**
 * Active Honic Nexis / Nexis Desk pricing (Tanzania).
 * - Membership: full Nexis Desk access for a year or a semester.
 * - Titles: paid plan gets 2 free hides; free plan pays per hide; 3rd+ on paid plan also paid.
 * - Jobs: browse free; posting and applying require an active paid plan.
 * - Project documents (literature / earlier project files): separate unlock.
 */
export const PRICING_BOARD = {
  membership: [
    {
      id: "monthly",
      name: "Monthly",
      priceTsh: SUBSCRIPTION_MONTH_TSH,
      period: "1+ months",
      summary: `Full Nexis Desk billed month by month (${SUBSCRIPTION_MONTH_TSH.toLocaleString("en-TZ")} TSh per month at checkout). Stack up to 12 months in one payment.`,
    },
    {
      id: "year",
      name: "Full year",
      priceTsh: SUBSCRIPTION_YEAR_TSH,
      period: "12 months",
      summary: `Full Nexis Desk for the academic year — workspace, Help desk, literature, Jobs posting & applying, and file storage up to ${formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES)}.`,
    },
    {
      id: "semester",
      name: "One semester",
      priceTsh: SUBSCRIPTION_SEMESTER_TSH,
      period: "6 months",
      summary: `Same full Nexis Desk for one semester — including Jobs posting & applying and file storage up to ${formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES)}.`,
    },
  ],
  titles: {
    freeHides: FREE_TITLE_SLOTS,
    extraHideTsh: EXTRA_TITLE_HIDE_FEE_TSH,
    note: `Paid plan: hide ${FREE_TITLE_SLOTS} titles free; each extra hide is ${EXTRA_TITLE_HIDE_FEE_TSH.toLocaleString("en-TZ")} TSh. Free plan: every hide costs ${EXTRA_TITLE_HIDE_FEE_TSH.toLocaleString("en-TZ")} TSh.`,
  },
  jobs: {
    note: "Browse Jobs listings on any plan. Posting, applying, and messaging need an active paid Nexis Desk plan.",
  },
  projectDocuments: {
    priceTsh: PROJECT_DOCUMENTS_ACCESS_TSH,
    note: "Unlock published documents attached to literature / earlier projects (study material, not a finished submission).",
  },
  storage: {
    freeBytes: FREE_PLAN_FILE_STORAGE_BYTES,
    paidBytes: PAID_PLAN_FILE_STORAGE_BYTES,
    note: `Paid Nexis Desk includes project file storage up to ${formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES)}.`,
  },
  freeAlways: [
    "Browse all literature titles",
    "Browse Jobs listings (view only)",
    "Blank workspace templates (when you have a workspace)",
  ],
  paidOnly: [
    "Help desk chat with Honic",
    "Jobs posting, applying, messaging, and managing",
    `${FREE_TITLE_SLOTS} free title hides from classmates`,
    `Project file storage up to ${formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES)}`,
  ],
  packs: DOCUMENT_PACKS,
} as const;
