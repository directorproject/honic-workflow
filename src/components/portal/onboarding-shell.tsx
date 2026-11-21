import type { ReactNode } from "react";

import { NexisBrandBar } from "@/components/brand/nexis-brand-bar";
import { SiteFooter } from "@/components/portal/site-footer";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=80";

/**
 * First-time student profile setup. A short hero band sits above the form on every screen size,
 * and the form uses the full width on desktop.
 */
export function OnboardingShell({
  step,
  children,
}: {
  step: 1 | 2;
  children: ReactNode;
}) {
  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col overflow-x-hidden">
      <div className="sticky top-0 z-30 shrink-0">
        <NexisBrandBar href="/portal" subtitle="Student portal" />
      </div>

      {/* Compact hero band (phone height on all screens) */}
      <aside className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(165deg, color-mix(in oklab, #0f172a 92%, transparent) 0%, color-mix(in oklab, #0f172a 75%, transparent) 60%, color-mix(in oklab, #0f172a 55%, transparent) 100%), radial-gradient(ellipse 55% 60% at 85% 10%, color-mix(in oklab, #06b6d4 30%, transparent), transparent 60%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[7.5rem] w-full max-w-5xl flex-col justify-end px-4 py-4 sm:min-h-[9rem] sm:px-8 sm:pb-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.26em] text-cyan-200/90 uppercase sm:text-[11px]">Honic Nexis</p>
              <h1 className="mt-1 text-lg leading-tight font-semibold tracking-tight text-white sm:text-2xl">
                {step === 1 ? "Set up your account" : "Course & institution"}
              </h1>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/75 sm:text-sm">
                {step === 1
                  ? "Name and phone first — same for email and Google."
                  : "Search your college and course, or skip for now."}
              </p>
            </div>
            <p className="shrink-0 font-mono text-[11px] tracking-wide text-white/60">Step {step} of 2</p>
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-x-clip px-3 py-5 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto w-full min-w-0 max-w-3xl">{children}</div>
      </section>

      <SiteFooter />
    </main>
  );
}
