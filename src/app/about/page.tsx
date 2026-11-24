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

      {/* Hero Section */}
      <div className="border-dash-border bg-gradient-to-b from-dash-card/50 to-dash-canvas border-b">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">About Us</p>
          <h1 className="text-dash-foreground mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Honic Company Limited
          </h1>
          <p className="text-dash-muted-foreground mt-5 text-lg leading-relaxed max-w-2xl">
            Innovations and research for engineering students and institutions. We help you find project titles, study prior
            work, plan delivery, and follow fabrication — from Dar es Salaam, Tanzania.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        {/* What We Offer */}
        <section className="mb-14">
          <h2 className="text-dash-foreground text-2xl font-bold mb-6">What we offer</h2>
          <div className="grid gap-5">
            <div className="border-dash-border bg-dash-card/40 rounded-lg border p-5">
              <h3 className="text-dash-foreground font-semibold mb-2">Honic Nexis</h3>
              <p className="text-dash-muted-foreground text-sm leading-relaxed">
                Student and supervisor portal for final year titles, peer help jobs, subscription plans, and
                collaborative project workspace.
              </p>
            </div>
            <div className="border-dash-border bg-dash-card/40 rounded-lg border p-5">
              <h3 className="text-dash-foreground font-semibold mb-2">Share Portal</h3>
              <p className="text-dash-muted-foreground text-sm leading-relaxed">
                A simple client view of project progress and deliverables when Honic is working on your project.
              </p>
            </div>
            <div className="border-dash-border bg-dash-card/40 rounded-lg border p-5">
              <h3 className="text-dash-foreground font-semibold mb-2">Engineering Support</h3>
              <p className="text-dash-muted-foreground text-sm leading-relaxed">
                Fabrication guidance, technical mentorship, project follow-up, and research support for students.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy Policy */}
        <section className="mb-14">
          <h2 className="text-dash-foreground text-2xl font-bold mb-6">Privacy Policy</h2>
          <div className="space-y-6 text-dash-muted-foreground">
            <div>
              <h3 className="text-dash-foreground font-semibold mb-2">1. Data We Collect</h3>
              <p className="text-sm leading-relaxed">
                We collect personal information you provide when creating an account or using our services, including: full name,
                email address, phone number, institution, course information, academic year, and project details. Payment information
                (phone number for mobile money) is collected for processing transactions but is never stored directly — it is processed
                securely through our payment provider, Snippe.
              </p>
            </div>

            <div>
              <h3 className="text-dash-foreground font-semibold mb-2">2. How We Use Your Data</h3>
              <p className="text-sm leading-relaxed mb-3">We use your information to:</p>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li>Authenticate your account and provide access to Honic Nexis services</li>
                <li>Process subscription payments and manage your plan access</li>
                <li>Match you with relevant project titles and peer-help opportunities</li>
                <li>Facilitate communication between students, supervisors, and clients</li>
                <li>Send service updates, reminders, and support communications</li>
                <li>Improve our services and user experience</li>
                <li>Comply with legal and regulatory requirements</li>
              </ul>
            </div>

            <div>
              <h3 className="text-dash-foreground font-semibold mb-2">3. Data Security & Payment Processing</h3>
              <p className="text-sm leading-relaxed">
                Your data is transmitted over secure HTTPS connections and stored in encrypted form. Payment processing is handled
                exclusively by Snippe, our trusted payment provider, using industry-standard security (PCI-DSS compliant). We never
                store or access your complete payment details.
              </p>
            </div>

            <div>
              <h3 className="text-dash-foreground font-semibold mb-2">4. Data Retention</h3>
              <p className="text-sm leading-relaxed">
                We retain your account data as long as your account is active. When you request account deletion, we remove your
                personal information within 30 days, except where required by law to maintain records (e.g., for payment history or
                legal compliance — typically 7 years).
              </p>
            </div>

            <div>
              <h3 className="text-dash-foreground font-semibold mb-2">5. Your Rights</h3>
              <p className="text-sm leading-relaxed mb-3">You have the right to:</p>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li>Access, update, or correct your personal information at any time in your account settings</li>
                <li>Request deletion of your account and associated data (subject to legal retention requirements)</li>
                <li>Opt out of non-essential communications</li>
                <li>Request a copy of your data in a portable format</li>
              </ul>
            </div>

            <div>
              <h3 className="text-dash-foreground font-semibold mb-2">6. Third-Party Services</h3>
              <p className="text-sm leading-relaxed">
                We use third-party services for authentication (Google), hosting (Vercel), database management (Supabase), and payments
                (Snippe). These services have their own privacy policies. We share only the minimum data necessary for them to provide
                their services.
              </p>
            </div>

            <div>
              <h3 className="text-dash-foreground font-semibold mb-2">7. Contact Us</h3>
              <p className="text-sm leading-relaxed">
                If you have privacy concerns or wish to exercise your rights, please contact us at{" "}
                <a href="mailto:portal@honiccompany.com" className="text-dash-accent font-semibold">
                  portal@honiccompany.com
                </a>
                . We will respond within 10 business days.
              </p>
            </div>

            <div className="text-xs text-dash-muted-foreground/70 pt-4 border-t border-dash-border">
              <p>Last updated: November 2026</p>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="bg-dash-card/40 rounded-lg border border-dash-border p-8">
          <h2 className="text-dash-foreground text-2xl font-bold mb-4">Get in touch</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-dash-muted-foreground">Project Management</p>
              <p className="text-dash-foreground font-semibold">
                Eng. N. Hamind{" "}
                <a href="tel:+255628882871" className="text-dash-accent hover:underline">
                  +255 628 882 871
                </a>
              </p>
            </div>
            <div>
              <p className="text-dash-muted-foreground">Assistant PM</p>
              <p className="text-dash-foreground font-semibold">
                Eng. D. Johndean{" "}
                <a href="tel:+255620518724" className="text-dash-accent hover:underline">
                  +255 620 518 724
                </a>
              </p>
            </div>
            <div>
              <p className="text-dash-muted-foreground">Email</p>
              <p className="text-dash-foreground font-semibold">
                <a href="mailto:portal@honiccompany.com" className="text-dash-accent hover:underline">
                  portal@honiccompany.com
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/portal" className="text-dash-accent font-semibold hover:underline">
            Open Honic Nexis →
          </Link>
          <Link href="/share-portal" className="text-dash-accent font-semibold hover:underline">
            Share portal
          </Link>
          <Link href="/portal/titles" className="text-dash-accent font-semibold hover:underline">
            Final year titles
          </Link>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
