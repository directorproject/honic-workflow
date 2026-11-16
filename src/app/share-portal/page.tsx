import Link from "next/link";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { SiteFooter } from "@/components/portal/site-footer";

export const dynamic = "force-static";
export const metadata = {
  title: "Share portal · Honic Company Limited",
  description:
    "Honic share portal — a private client link to follow project progress, milestones, and updates while Honic delivers your work.",
};

export default function SharePortalPage() {
  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">Share portal</p>
        <h1 className="text-dash-foreground mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Follow your project with Honic
        </h1>
        <p className="text-dash-muted-foreground mt-4 text-base leading-relaxed">
          When Honic is delivering a project for you, you get a private share link. Open it anytime to see progress,
          milestones, and updates — without signing into the student portal.
        </p>

        <section className="border-dash-border bg-dash-card mt-8 rounded-2xl border px-5 py-6 sm:px-6">
          <h2 className="text-dash-foreground text-sm font-semibold">What the share link is for</h2>
          <ul className="text-dash-muted-foreground mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>See where the project stands and what happens next</li>
            <li>Read Honic progress updates in one place</li>
            <li>Share the same link with a supervisor or sponsor when needed</li>
            <li>Keep student tools (titles, jobs, desk) separate in Honic Nexis</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-dash-foreground text-sm font-semibold">How you get a link</h2>
          <p className="text-dash-muted-foreground text-sm leading-relaxed">
            Honic sends your share link after your project is set up for delivery. Keep it private — anyone with the URL
            can open the client view. If you lose the link, contact project support and we will resend it.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-dash-foreground text-sm font-semibold">Students and supervisors</h2>
          <p className="text-dash-muted-foreground text-sm leading-relaxed">
            Studying titles, shortlisting, jobs, and the workspace live in{" "}
            <Link href="/portal" className="text-dash-accent font-semibold">
              Honic Nexis
            </Link>
            . The share portal is only the client progress view for projects Honic is building.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/portal" className="text-dash-accent">
            Open student portal →
          </Link>
          <Link href="/about" className="text-dash-accent">
            About Honic
          </Link>
          <a href="mailto:portal@honiccompany.com" className="text-dash-accent">
            Contact support
          </a>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
