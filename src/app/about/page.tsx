import Link from "next/link";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { SiteFooter } from "@/components/portal/site-footer";

export const dynamic = "force-static";
export const metadata = { title: "About · Honic Company Limited" };

export default function AboutPage() {
  return (
    <main className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-canvas/95 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
        <CompanyBrandBar variant="full" />
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">Honic Company Limited</p>
        <h1 className="text-dash-foreground mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Innovations and research</h1>
        <p className="text-dash-muted-foreground mt-4 text-base leading-relaxed">
          We support engineering students and institutions with project titles, literature review, workspace tools,
          fabrication help, and project follow-up from Dar es Salaam, Tanzania.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="text-dash-foreground text-sm font-semibold">What students use</h2>
          <ul className="text-dash-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>Literature review of completed final year projects and new project titles</li>
            <li>Up to two title selections, hidden from the same department and level</li>
            <li>A student workspace for plans, logbook, documents, and payments</li>
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
          <Link href="/portal/titles" className="text-dash-accent">
            Open literature review
          </Link>
          <Link href="/portal" className="text-dash-accent">
            Student portal
          </Link>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
