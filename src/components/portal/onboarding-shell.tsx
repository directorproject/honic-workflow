import type { ReactNode } from "react";

import { NexisBrandBar } from "@/components/brand/nexis-brand-bar";
import { SiteFooter } from "@/components/portal/site-footer";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=80";

/** Full-page website chrome for first-time student profile setup (not a doc card). */
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

      <div className="grid flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {/* Brand panel — website feel on desktop; compact band on mobile */}
        <aside className="relative overflow-hidden lg:min-h-[calc(100vh-3.5rem)]">
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
                "linear-gradient(165deg, color-mix(in oklab, #0f172a 90%, transparent) 0%, color-mix(in oklab, #0f172a 72%, transparent) 55%, color-mix(in oklab, #0f172a 50%, transparent) 100%), radial-gradient(ellipse 55% 50% at 80% 15%, color-mix(in oklab, #06b6d4 32%, transparent), transparent 60%)",
            }}
          />
          <div className="relative flex min-h-[11rem] flex-col justify-end px-5 py-8 sm:min-h-[13rem] sm:px-8 sm:py-10 lg:min-h-full lg:px-12 lg:py-14">
            <p className="text-[10px] font-semibold tracking-[0.26em] text-cyan-200/90 uppercase sm:text-[11px]">
              Honic Nexis
            </p>
            <h1 className="mt-2 max-w-sm text-2xl leading-tight font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
              {step === 1 ? "Set up your account" : "Almost ready"}
            </h1>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/75 sm:mt-3">
              {step === 1
                ? "Name and phone first — same for email and Google. Then you can open plans."
                : "Add your course and institution, or skip and finish later."}
            </p>
            <p className="mt-5 font-mono text-xs tracking-wide text-white/50">
              Step {step} of 2
            </p>
          </div>
        </aside>

        {/* Form column */}
        <section className="flex flex-col justify-center px-4 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
          <div className="mx-auto w-full max-w-[22rem] sm:max-w-sm">{children}</div>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
