import Link from "next/link";

/** Sticky strip: guests can look around; sign-in unlocks real actions. */
export function GuestPreviewBanner({
  blurb = "Browse freely to see what Honic Nexis offers. Sign in to shortlist titles, apply for jobs, open documents, or use Desk tools.",
}: {
  blurb?: string;
}) {
  return (
    <div className="border-dash-border bg-dash-card mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
      <div className="min-w-0">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">Preview mode</p>
        <p className="text-dash-foreground mt-0.5 text-sm leading-relaxed">{blurb}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href="/portal?auth=signin"
          className="bg-dash-accent inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
        <Link
          href="/portal?auth=signup"
          className="border-dash-border text-dash-foreground inline-flex items-center justify-center rounded-lg border px-3.5 py-2 text-sm font-semibold"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
