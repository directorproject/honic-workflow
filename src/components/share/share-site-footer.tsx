const YEAR = new Date().getFullYear();

function NoticeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

export function ShareSiteFooter() {
  return (
    <>
      <div
        role="note"
        className="mx-auto mt-10 max-w-7xl px-4 sm:mt-12 sm:px-6 lg:px-8"
      >
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm leading-relaxed text-red-800 sm:px-5 sm:py-3.5 dark:border-red-900/80 dark:bg-red-950/45 dark:text-red-100">
          <NoticeIcon className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
          <p>
            Use Preview when your browser can open the file; otherwise use Download—everything here is for this
            project only.
          </p>
        </div>
      </div>

      <footer className="border-dash-border text-dash-muted-foreground mx-auto mt-6 max-w-7xl border-t px-4 pb-28 pt-8 text-center text-xs leading-relaxed sm:mt-8 sm:px-6 sm:pb-12 sm:text-sm lg:px-8">
      <p className="text-dash-foreground text-sm font-semibold sm:text-base">Honic Company Limited</p>
      <p className="mt-1">© {YEAR} All rights reserved.</p>

      <div className="mt-6 space-y-2">
        <p className="text-dash-foreground text-xs font-semibold uppercase tracking-wide">Support</p>
        <p>
          POC Eng. Hamid —{" "}
          <a href="tel:+255628882871" className="text-dash-accent font-medium underline-offset-2 hover:underline">
            +255 628 882 871
          </a>
        </p>
        <p>
          POC Eng. John —{" "}
          <a href="tel:+255620518724" className="text-dash-accent font-medium underline-offset-2 hover:underline">
            +255 620 518 724
          </a>
        </p>
      </div>

      <p className="border-dash-border text-dash-muted-foreground/90 mt-8 border-t pt-6 text-[11px] sm:text-xs">
        This is a private share link. Do not forward it unless you intend to share project visibility with others.
      </p>
    </footer>
    </>
  );
}
