/** Bump a version when that text changes. Students must accept the new version before they continue. */
export const POLICY_VERSION = "2026-11-24";
export const TITLE_RULES_VERSION = "2026-11-24";

export type ShortPoint = { headline: string; line: string };
export type FullClause = { title: string; body: string };

/** The first screen. Short enough to read. */
export const POLICY_POINTS: ShortPoint[] = [
  {
    headline: "Not a shop",
    line: "Titles are not for sale. This portal helps you study earlier work and choose a starting point. Honic does not sell finished projects here.",
  },
  {
    headline: "See what came before",
    line: "Read the earlier titles so you can see what students already did, and notice what is still left open.",
  },
  {
    headline: "Your college decides",
    line: "Your supervisor and department still approve your project. These words do not replace their rules.",
  },
  {
    headline: "You answer for it",
    line: "What you submit is your own responsibility. You cannot hand in a project you did not change and then blame this portal.",
  },
];

/** The second screen, after the policy. */
export const RULE_POINTS: ShortPoint[] = [
  {
    headline: "Select keeps it in front",
    line: "Selecting a title is free. It only puts the title on your shortlist so you and your partner can work on it. Classmates can still see it until it is hidden.",
  },
  {
    headline: "Pay to make yours & hide",
    line: "Pay or use a paid plan to hide and make a title yours. It is not a purchase of the idea. It only hides the title from others for conflict protection for defence.",
  },
  {
    headline: "Free plan vs paid plan",
    line: "On a free plan every hide is paid. On a paid Nexis Desk plan you get two free hides; further hides are paid. Plans unlock Nexis Desk access; they do not sell titles.",
  },
  {
    headline: "Study it and change it",
    line: "Read the title, then change the project. Do not copy it or hand it in as it is. Hiding is conflict protection for defence, not ownership of someone else's work.",
  },
];

export const POLICY_FULL: FullClause[] = [
  {
    title: "What this portal is",
    body: "This portal is a final year titles catalogue from Honic Company Limited, Innovation and Research. It shows project titles that were written before, and starting points you may study. It is not a shop. Honic does not sell a finished project or sell ownership of an idea here.",
  },
  {
    title: "Earlier work",
    body: "Titles marked as earlier work show what students already did. They are for reading. You cannot take them as a finished submission, and you cannot copy them into your submission.",
  },
  {
    title: "Your college still decides",
    body: "This policy does not replace the rules of your institution, your department, or your supervisor. You still need their approval. Where their rules are stricter, you follow those rules.",
  },
  {
    title: "You are responsible",
    body: "You are responsible for the project you submit. If you hand in a project that is still the original title with no real change, you break these terms. Honic may release the title so other students can work without that block.",
  },
  {
    title: "Payments on this portal",
    body: "Mobile-money payments (for Nexis Desk plans or to hide a title from classmates) are processed securely. A payment does not mean you bought the title as a product. It only activates Nexis Desk access or classmate-hide protection so you can work and defend with less conflict.",
  },
];

export const RULES_FULL: FullClause[] = [
  {
    title: "Study the work",
    body: "Before you take a title, read it. Understand what it already does, what is missing, and what has not been done yet. Look at the idea, the hardware, the communication, and the method, and decide what must change.",
  },
  {
    title: "Change the project",
    body: "A title you take is only a starting point. Change the project. Do not copy it, do not submit it as it is, and do not present another person's work as your own. The work you submit must be yours, with a real change in the problem, the design, the method, or the scope.",
  },
  {
    title: "Select (shortlist), free",
    body: "You may select titles for free to keep them in front on your shortlist. Selection alone does not hide the title from other students. It only helps you and your partner keep focus while you study and prepare.",
  },
  {
    title: "Pay to make yours and hide from others",
    body: "When you pay to make a title yours and hide it, that title is protected from other students at your institution, in your department, and at your level. Students elsewhere can still read it. This is conflict protection for defence with classmates or partners. It is not a sale of the title, and it does not make you the owner of the idea.",
  },
  {
    title: "Free plan and paid Nexis Desk plans",
    body: "On a free plan, selecting is free, but every classmate-hide requires payment. On an active paid Nexis Desk plan (year or semester), you receive two free classmate-hides; each further hide requires payment. A Nexis Desk plan is for portal access (workspace, help desk, and related tools). It does not turn this portal into a title shop.",
  },
  {
    title: "Why a title is hidden",
    body: "Hiding exists so two students in the same group do not claim the same starting point into defence by accident. Hiding is temporary protection on this portal while you work. Your college still decides the final project. Honic may release a title if you break these rules or abandon the work.",
  },
];

export type TermsProgress = {
  policyAccepted: boolean;
  rulesAccepted: boolean;
  /** Both the policy and the title rules are accepted for the current versions. */
  accepted: boolean;
  acceptedAt: string | null;
};

export function titleTermsStatus(metadata: unknown): TermsProgress {
  const meta = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const policyAt = typeof meta.portal_policy_accepted_at === "string" ? meta.portal_policy_accepted_at : null;
  const rulesAt = typeof meta.title_rules_accepted_at === "string" ? meta.title_rules_accepted_at : null;
  const policyAccepted = meta.portal_policy_version === POLICY_VERSION && Boolean(policyAt);
  const rulesAccepted = meta.title_rules_version === TITLE_RULES_VERSION && Boolean(rulesAt);
  return {
    policyAccepted,
    rulesAccepted,
    accepted: policyAccepted && rulesAccepted,
    acceptedAt: policyAccepted && rulesAccepted ? rulesAt : null,
  };
}
