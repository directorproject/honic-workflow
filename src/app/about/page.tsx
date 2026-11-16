import Link from "next/link";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { SiteFooter } from "@/components/portal/site-footer";

export const dynamic = "force-static";
export const metadata = {
  title: "About Honic · Honic Company Limited",
  description:
    "Honic Company Limited — innovations and research for engineering students and institutions in Dar es Salaam, Tanzania.",
};

export default function AboutPage() {
  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">About Honic</p>
        <h1 className="text-dash-foreground mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Honic Company Limited
        </h1>
        <p className="text-dash-muted-foreground mt-4 text-base leading-relaxed">
          Innovations and research for engineering students and institutions. We help you find project titles, study prior
          work, plan delivery, and follow fabrication — from Dar es Salaam, Tanzania.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-dash-foreground text-sm font-semibold">What we offer</h2>
          <ul className="text-dash-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>
              <span className="text-dash-foreground font-medium">Honic Nexis</span> — student and supervisor portal for
              literature, titles, jobs, plans, and project workspace
            </li>
            <li>
              <span className="text-dash-foreground font-medium">Share portal</span> — a simple client view of project
              progress when Honic is delivering your work
            </li>
            <li>Engineering support, fabrication guidance, and project follow-up</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-dash-foreground text-sm font-semibold">Talk to us</h2>
          <p className="text-dash-muted-foreground text-sm leading-relaxed">
            Project management: Eng. N. Hamind{" "}
            <a href="tel:+255628882871" className="text-dash-accent font-semibold">
              +255 628 882 871
            </a>
            . Assistant PM: Eng. D. Johndean{" "}
            <a href="tel:+255620518724" className="text-dash-accent font-semibold">
              +255 620 518 724
            </a>
            . Email{" "}
            <a href="mailto:portal@honiccompany.com" className="text-dash-accent font-semibold">
              portal@honiccompany.com
            </a>
            .
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/portal" className="text-dash-accent">
            Open Honic Nexis →
          </Link>
          <Link href="/share-portal" className="text-dash-accent">
            About the share portal
          </Link>
          <Link href="/portal/titles" className="text-dash-accent">
            Literature review
          </Link>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
