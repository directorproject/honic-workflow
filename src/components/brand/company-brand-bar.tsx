import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

const TAGLINE = "Innovations and research";

/**
 * Company identity: logo from `/logo.jpg` + Honic Company Limited + tagline.
 * Use `compact` in the dashboard sidebar; `full` on the top strip (share + main app).
 */
export function CompanyBrandBar({
  variant = "full",
  onNavigate,
  endContent,
}: {
  variant?: "full" | "compact";
  /** e.g. close mobile drawer when the home link is used */
  onNavigate?: () => void;
  /** Extra block on the right (e.g. share page notice); `full` variant only. */
  endContent?: ReactNode;
}) {
  if (variant === "compact") {
    return (
      <Link
        href="/"
        onClick={onNavigate}
        className="border-dash-border flex items-center gap-3 border-b px-5 py-5 transition-opacity hover:opacity-95"
      >
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
          <Image
            src="/logo.jpg"
            alt="Honic Company Limited"
            fill
            className="rounded-xl object-contain"
            sizes="44px"
            priority
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight text-slate-50">Honic Company Limited</p>
          <p className="text-dash-sidebar-muted truncate text-[10px] font-medium tracking-widest uppercase">
            {TAGLINE}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <div className="border-dash-border bg-white dark:bg-dash-card border-b">
      <div
        className={`mx-auto flex max-w-7xl px-4 py-3 sm:px-6 lg:px-8 ${
          endContent
            ? "flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            : "items-center gap-4 sm:gap-6"
        }`}
      >
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <div className="flex shrink-0 flex-col items-stretch">
            <div className="relative h-16 w-[4.5rem] overflow-hidden rounded-2xl sm:h-[4.5rem] sm:w-24">
              <Image
                src="/logo.jpg"
                alt="Honic Company Limited"
                fill
                className="rounded-2xl object-contain object-left"
                sizes="(max-width: 640px) 72px, 96px"
                priority
              />
            </div>
            <div className="bg-[#0c4a6e] dark:bg-dash-accent mt-1.5 h-1 w-full max-w-[5.5rem] rounded-sm sm:max-w-[6.5rem]" />
          </div>
          <div className="min-w-0 py-0.5">
            <p className="text-[#0f172a] dark:text-dash-foreground text-base font-bold tracking-tight sm:text-lg">
              Honic Company Limited
            </p>
            <p className="text-slate-600 dark:text-dash-muted-foreground mt-0.5 text-[10px] font-semibold tracking-[0.2em] uppercase sm:text-xs">
              {TAGLINE}
            </p>
          </div>
        </div>
        {endContent ? (
          <div className="border-dash-border hidden min-w-0 flex-col gap-1 border-t pt-3 sm:flex sm:max-w-md sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0 lg:max-w-xl">
            {endContent}
          </div>
        ) : null}
      </div>
    </div>
  );
}
