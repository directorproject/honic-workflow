/** Nexis peer help (jobs board) — policy shown at post/apply. */

export const PEER_HELP_RULES_VERSION = "2026-11-18";

export const PEER_HELP_RULES_SUMMARY = [
  {
    headline: "You stay the author",
    line: "Peer help only. Work you submit to your college must be yours — helpers advise, format, or draw; they do not ghostwrite.",
  },
  {
    headline: "Not for sale here",
    line: "No full reports, chapters, proposals, exam answers, or “write it for me” tasks.",
  },
  {
    headline: "What fits",
    line: "Diagrams, slides layout, circuit/CAD help, formatting, and tutoring on work you already started.",
  },
  {
    headline: "Enforcement",
    line: "Honic may remove posts or limit accounts that break these rules.",
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
