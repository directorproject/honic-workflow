import {
  EXTRA_TITLE_HIDE_FEE_TSH,
  FREE_PLAN_FREE_HIDES,
  FREE_TITLE_SLOTS,
  PAID_PLAN_FREE_HIDES,
} from "@/lib/portal/config";

export { FREE_TITLE_SLOTS, EXTRA_TITLE_HIDE_FEE_TSH, PAID_PLAN_FREE_HIDES, FREE_PLAN_FREE_HIDES };

/** Soft upper bound on simultaneous shortlisted titles. */
export const MAX_TITLE_CHOICES = 20;

/** Guests may browse this many titles before Create account is required. */
export const GUEST_TITLE_PREVIEW_LIMIT = 10;

/** How many titles to paint at first / each Load more on the literature list. */
export const TITLE_LIST_PAGE_SIZE = 30;

export function hasActiveDeskPlan(deskExpiresAt: string | null | undefined): boolean {
  if (!deskExpiresAt) return false;
  const t = new Date(deskExpiresAt).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export function freeHideAllowance(hasPaidPlan: boolean): number {
  return hasPaidPlan ? PAID_PLAN_FREE_HIDES : FREE_PLAN_FREE_HIDES;
}

export function planModeLabel(input: {
  deskExpiresAt?: string | null;
  deskPlan?: string | null;
}): { mode: "paid" | "trial" | "free"; title: string; detail: string } {
  const active = hasActiveDeskPlan(input.deskExpiresAt);
  if (!active) {
    return {
      mode: "free",
      title: "Free plan",
      detail: "",
    };
  }
  const until = input.deskExpiresAt
    ? new Date(input.deskExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";
  if (String(input.deskPlan ?? "").toLowerCase() === "trial") {
    return {
      mode: "trial",
      title: "2-week free trial",
      detail: until
        ? `Full monthly Desk limits until ${until}. Pay a plan to keep access after the trial.`
        : `Full monthly Desk limits. Pay a plan to keep access after the trial.`,
    };
  }
  const plan =
    input.deskPlan === "semester"
      ? "Nexis Desk · Semester"
      : input.deskPlan === "monthly"
        ? "Nexis Desk · Monthly"
        : "Nexis Desk · Full year";
  return {
    mode: "paid",
    title: plan,
    detail: until
      ? `Active until ${until}. Includes ${PAID_PLAN_FREE_HIDES} free hides, Jobs posting & applying.`
      : `Includes ${PAID_PLAN_FREE_HIDES} free hides, Jobs posting & applying.`,
  };
}

export type TitleHideEntitlement = {
  hasPaidPlan: boolean;
  freeAllowance: number;
  freeRemaining: number;
  hideCredits: number;
  /** Titles currently shortlisted (selected). */
  selectedCount: number;
  /** Titles currently hidden from peers. */
  hiddenCount: number;
  canHideNow: boolean;
  needsPayment: boolean;
  feeTsh: number;
};

/** How many peer-hides this student may still apply without paying again. */
export function titleHideEntitlement(input: {
  deskExpiresAt?: string | null;
  changeCredits: number;
  selectedCount: number;
  hiddenCount: number;
}): TitleHideEntitlement {
  const hasPaidPlan = hasActiveDeskPlan(input.deskExpiresAt);
  const freeAllowance = freeHideAllowance(hasPaidPlan);
  const freeRemaining = Math.max(0, freeAllowance - input.hiddenCount);
  const hideCredits = Math.max(0, Math.floor(Number(input.changeCredits) || 0));
  const canHideNow = freeRemaining > 0 || hideCredits > 0;
  return {
    hasPaidPlan,
    freeAllowance,
    freeRemaining,
    hideCredits,
    selectedCount: input.selectedCount,
    hiddenCount: input.hiddenCount,
    canHideNow,
    needsPayment: !canHideNow,
    feeTsh: EXTRA_TITLE_HIDE_FEE_TSH,
  };
}
