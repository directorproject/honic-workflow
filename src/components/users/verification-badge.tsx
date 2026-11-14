/** Shown when the account email is confirmed. */
export function VerificationBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm2.9 5.1-3.2 3.7a.75.75 0 0 1-1.12.04L5.1 8.7a.75.75 0 1 1 1.1-1.02l1 1.08 2.66-3.08a.75.75 0 1 1 1.14.98Z"
          />
        </svg>
        Verified
      </span>
    );
  }

  return (
    <span className="bg-dash-muted text-dash-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
      Not verified
    </span>
  );
}
