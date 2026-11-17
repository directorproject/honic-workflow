import type { ReactNode } from "react";

import { NexisBrandBar } from "@/components/brand/nexis-brand-bar";
import { SiteFooter } from "@/components/portal/site-footer";

/** Shared /portal and /supervisor auth chrome — respects light and dark theme. */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="bg-dash-canvas text-dash-foreground relative flex min-h-screen flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_10%_-10%,color-mix(in_oklab,var(--dash-accent)_22%,transparent),transparent_55%),radial-gradient(900px_500px_at_90%_10%,color-mix(in_oklab,var(--dash-foreground)_8%,transparent),transparent_50%)] dark:bg-[radial-gradient(1200px_600px_at_10%_-10%,color-mix(in_oklab,var(--dash-accent)_18%,transparent),transparent_55%),radial-gradient(900px_500px_at_90%_12%,color-mix(in_oklab,var(--dash-accent)_10%,transparent),transparent_50%)]"
      />
      <div className="sticky top-0 z-30 shrink-0">
        <NexisBrandBar />
      </div>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</div>
      <SiteFooter />
    </main>
  );
}
