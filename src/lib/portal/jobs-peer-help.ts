/** Nexis peer help (jobs board) — policy shown at post/apply. */

export const PEER_HELP_RULES_VERSION = "2026-11-22-escrow-v2";

export const PEER_HELP_RULES_SUMMARY = [
  {
    headline: "You stay the author",
    line: "Peer help only. Helpers may advise, format, draw, or tutor. They must not ghostwrite work you will submit to your college.",
  },
  {
    headline: "Not for sale here",
    line: "No full reports, chapters, proposals, exam answers, or “write it for me” tasks.",
  },
  {
    headline: "What fits",
    line: "Diagrams, slide layout, circuit or CAD help, formatting, and tutoring on work you already started.",
  },
  {
    headline: "Stay anonymous",
    line: "Do not share real names, phone numbers, WhatsApp, or other contacts in posts, offers, or chat. Use Nexis only.",
  },
  {
    headline: "One helper via escrow",
    line: "Many people may offer. The poster picks one, locks mobile-money escrow, then that helper is assigned and other offers close.",
  },
  {
    headline: "Secure delivery",
    line: "Helper uploads a watermarked preview plus a final file. The poster reviews the preview only — the final file unlocks after release.",
  },
  {
    headline: "Payment & disputes",
    line: "Funds release when the poster confirms, after the review timeout, or when Honic settles a dispute. No off-app peer payments.",
  },
  {
    headline: "Enforcement",
    line: "Honic may remove posts, hold escrow decisions, or limit accounts that break these rules.",
  },
] as const;

export const PEER_HELP_ALLOWED_HINT =
  "Describe diagrams, formatting, or tutoring — not a full document or chapter.";
export const PEER_HELP_FORBIDDEN_HINT = "Do not ask for whole reports, exam answers, or submission-ready text.";

export function peerHelpRulesError(): string {
  return "Accept the peer-help rules before you continue.";
}
export const PEER_HELP_METADATA_KEY = "peer_help_rules_version";

/** True when this student has accepted the current version of the peer-help rules. */
export function peerHelpAccepted(user: { user_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return (user?.user_metadata?.[PEER_HELP_METADATA_KEY] ?? null) === PEER_HELP_RULES_VERSION;
}
