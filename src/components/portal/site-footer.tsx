"use client";

import { NexisWordmark } from "@/components/brand/nexis-wordmark";
import { TrackedAnchor, TrackedLink } from "@/components/portal/tracked-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const YEAR = new Date().getFullYear();

const SUPPORT = [
  { name: "PM Eng. N. Hamind", phone: "+255 628 882 871", tel: "+255628882871", wa: "255628882871", key: "hamind" },
  { name: "APM Eng. D. Johndean", phone: "+255 620 518 724", tel: "+255620518724", wa: "255620518724", key: "johndean" },
] as const;

const PORTAL_LINKS = [
  { href: "/portal", label: "Student portal", key: "footer-portal" },
  { href: "/portal/titles", label: "Literature review", key: "footer-titles" },
  { href: "/portal/home?tab=projects", label: "My projects & titles", key: "footer-projects" },
  { href: "/portal/jobs", label: "Peer help", key: "footer-jobs" },
  { href: "/portal/packs", label: "Plans & access", key: "footer-packs" },
] as const;

const COMPANY_LINKS = [
  { href: "/about", label: "About Honic", key: "footer-about" },
  { href: "/share-portal", label: "Share portal", key: "footer-share-portal" },
] as const;

function WhatsAppIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 1.82c2.17 0 4.21.85 5.75 2.39a8.1 8.1 0 012.37 5.7c0 4.46-3.63 8.09-8.12 8.09-1.42 0-2.8-.37-4.01-1.07l-.29-.17-3.12.82.83-3.04-.19-.31a8.07 8.07 0 01-1.24-4.32c0-4.46 3.63-8.09 8.12-8.09zm4.52 10.35c-.2-.1-1.18-.58-1.36-.65-.18-.07-.31-.1-.44.1-.13.2-.5.65-.62.78-.11.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.53-.99-1.18-1.11-1.38-.11-.2-.01-.3.09-.4.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.33h-.37c-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.61s.7 1.87.8 2c.1.13 1.37 2.09 3.32 2.93.46.2.82.32 1.1.41.46.15.88.13 1.21.08.37-.06 1.18-.48 1.35-.95.17-.47.17-.87.12-.95-.05-.08-.18-.13-.38-.23z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293a1.125 1.125 0 01-1.21.38 12.035 12.035 0 01-7.143-7.143 1.125 1.125 0 01.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

export function SiteFooter({
  className = "",
  variant = "default",
}: {
  className?: string;
  /** Share pages keep extra bottom space for the sticky nav. */
  variant?: "default" | "share";
}) {
  const pad = variant === "share" ? "pb-28 pt-8 sm:pb-14 sm:pt-10" : "py-10 sm:py-12";

  return (
    <footer className={`border-dash-border bg-dash-card/70 text-dash-muted-foreground mt-auto border-t ${pad} ${className}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-5">
            <NexisWordmark href="/portal" size="lg" subtitle="Honic Company Limited" />
            <p className="mt-4 max-w-md text-sm leading-relaxed">
              Engineering project support for students and institutions: titles, literature review, workspace, fabrication,
              and project follow-up from Dar es Salaam, Tanzania.
            </p>
            <p className="mt-4 text-sm">
              <TrackedAnchor
                linkKey="footer-email"
                trackLabel="portal@honiccompany.com"
                href="mailto:portal@honiccompany.com"
                className="text-dash-accent font-medium underline-offset-2 hover:underline"
              >
                portal@honiccompany.com
              </TrackedAnchor>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 sm:col-span-2 sm:gap-8 lg:col-span-4 lg:contents">
            <div className="min-w-0 lg:col-span-2">
              <p className="text-dash-foreground text-xs font-semibold tracking-wide uppercase">Student</p>
              <ul className="mt-3 space-y-2.5 text-sm">
                {PORTAL_LINKS.map((item) => (
                  <li key={item.href}>
                    <TrackedLink
                      linkKey={item.key}
                      trackLabel={item.label}
                      href={item.href}
                      className="hover:text-dash-foreground transition-colors"
                    >
                      {item.label}
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>

            <div className="min-w-0 lg:col-span-2">
              <p className="text-dash-foreground text-xs font-semibold tracking-wide uppercase">Company</p>
              <ul className="mt-3 space-y-2.5 text-sm">
                {COMPANY_LINKS.map((item) => (
                  <li key={item.href}>
                    <TrackedLink
                      linkKey={item.key}
                      trackLabel={item.label}
                      href={item.href}
                      className="hover:text-dash-foreground transition-colors"
                    >
                      {item.label}
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-3">
            <p className="text-dash-foreground text-xs font-semibold tracking-wide uppercase">Support</p>
            <ul className="mt-3 space-y-4">
              {SUPPORT.map((person) => (
                <li key={person.tel}>
                  <p className="text-dash-foreground text-sm font-medium">{person.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <TrackedAnchor
                      linkKey={`support-tel-${person.key}`}
                      trackLabel={`Call ${person.name}`}
                      href={`tel:${person.tel}`}
                      className="border-dash-border hover:border-dash-foreground/40 hover:text-dash-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                    >
                      <PhoneIcon />
                      {person.phone}
                    </TrackedAnchor>
                    <TrackedAnchor
                      linkKey={`support-wa-${person.key}`}
                      trackLabel={`WhatsApp ${person.name}`}
                      href={`https://wa.me/${person.wa}`}
                      target="_blank"
                      rel="noreferrer"
                      className="border-dash-border hover:border-dash-foreground/40 hover:text-dash-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                    >
                      <WhatsAppIcon />
                      WhatsApp
                    </TrackedAnchor>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-dash-border mt-10 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {YEAR} Honic Company Limited. All rights reserved.</p>
          <div className="flex items-center gap-3 sm:justify-end">
            <ThemeToggle />
            <p className="sm:text-right">Innovation and Research Department · Dar es Salaam, Tanzania</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
