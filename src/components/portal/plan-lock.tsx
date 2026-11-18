import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shows a page to everyone, with paid-only parts blurred behind a card.
 * `children` must never contain real paid data for a locked viewer: pass a preview or
 * placeholder layout. Server enforcement (actions, API routes) still applies to every real action.
 */
export function PlanLock({
  locked,
  title,
  body,
  children,
}: {
  locked: boolean;
  title: string;
  body: string;
  children: ReactNode;
}) {
  if (!locked) return <>{children}</>;

  return (
    <div className="relative isolate">
      <div aria-hidden inert className="pointer-events-none origin-top select-none blur-[2.5px] opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex justify-center bg-dash-canvas/30 px-4 pt-6 sm:pt-10">
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`${title} is part of Nexis Desk`}
          className="border-dash-border bg-dash-card sticky top-24 h-fit w-full max-w-md rounded-2xl border p-6 text-center shadow-[0_30px_60px_-30px_rgba(2,6,23,0.45)]"
        >
          <span className="bg-dash-accent/10 text-dash-accent inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase">
            Nexis Desk
          </span>
          <h2 className="text-dash-foreground mt-3 text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/portal/packs#plans"
              className="bg-dash-accent inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
            >
              See plans
            </Link>
            <Link
              href="/portal/titles"
              className="border-dash-border text-dash-foreground inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold"
            >
              Browse literature free
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
