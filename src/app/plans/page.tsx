import Link from "next/link";

import { NexisWordmark } from "@/components/brand/nexis-wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SiteFooter } from "@/components/portal/site-footer";
import {
  SUBSCRIPTION_YEAR_TSH,
  SUBSCRIPTION_SEMESTER_TSH,
  SUBSCRIPTION_MONTH_TSH,
  PAID_PLAN_FREE_HIDES,
  EXTRA_TITLE_HIDE_FEE_TSH,
  formatStorageQuota,
  PAID_PLAN_FILE_STORAGE_BYTES,
  FREE_PLAN_FILE_STORAGE_BYTES,
  PAYMENT_NETWORKS,
} from "@/lib/portal/config";

export const dynamic = "force-static";
export const runtime = "nodejs";

const PLANS = [
  {
    id: "free",
    name: "Free Plan",
    description: "Get started with Nexis",
    price: "0 TSH",
    period: "Forever",
    cta: "Get Started",
    popular: false,
    features: [
      `${PAID_PLAN_FREE_HIDES} free title hides/month (additional: ${EXTRA_TITLE_HIDE_FEE_TSH.toLocaleString()} TSH each)`,
      "Browse available jobs",
      `${formatStorageQuota(FREE_PLAN_FILE_STORAGE_BYTES)} project file storage`,
      "Access public project library",
      "Track your project timeline",
    ],
    ctaHref: "/portal?auth=signup",
  },
  {
    id: "monthly",
    name: "Nexis Desk",
    description: "Pay monthly flexibility",
    price: `${SUBSCRIPTION_MONTH_TSH.toLocaleString()}`,
    period: "per month",
    cta: "Start Monthly",
    popular: false,
    features: [
      `${PAID_PLAN_FREE_HIDES} free title hides included`,
      "Post & apply for jobs",
      `${formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES)} project file storage`,
      "Full workspace tools (Gantt, calendar, documents)",
      "Real-time collaboration",
      "Direct supervisor messaging",
      "No lock-in contract",
    ],
    ctaHref: "/portal/payments",
  },
  {
    id: "semester",
    name: "Nexis Desk Semester",
    description: "5-6 month academic term",
    price: `${SUBSCRIPTION_SEMESTER_TSH.toLocaleString()}`,
    period: "one semester",
    cta: "Start Semester",
    popular: true,
    badge: "20% discount",
    features: [
      `${PAID_PLAN_FREE_HIDES} free title hides included`,
      "Post & apply for jobs",
      `${formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES)} project file storage`,
      "Full workspace tools (Gantt, calendar, documents)",
      "Real-time collaboration",
      "Direct supervisor messaging",
      "Perfect for academic term coverage",
    ],
    ctaHref: "/portal/payments",
  },
  {
    id: "annual",
    name: "Nexis Desk Annual",
    description: "Best value for the year",
    price: `${SUBSCRIPTION_YEAR_TSH.toLocaleString()}`,
    period: "per year",
    cta: "Start Annual",
    popular: false,
    badge: "Best value",
    features: [
      `${PAID_PLAN_FREE_HIDES} free title hides included`,
      "Post & apply for jobs",
      `${formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES)} project file storage`,
      "Full workspace tools (Gantt, calendar, documents)",
      "Real-time collaboration",
      "Direct supervisor messaging",
      "Cover your entire project year",
    ],
    ctaHref: "/portal/payments",
  },
];

function formatPrice(price: string): { amount: string; currency: string } {
  const match = price.match(/^([\d,]+)\s*([A-Z]+)$/);
  if (match) {
    return { amount: match[1], currency: match[2] };
  }
  return { amount: price, currency: "" };
}

export default function PlansPage() {
  const pricedPlans = PLANS.map((plan) => ({
    ...plan,
    formattedPrice: formatPrice(plan.price),
  }));

  return (
    <div className="bg-dash-canvas text-dash-foreground min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-dash-border/50 bg-dash-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <NexisWordmark />
            <h1 className="text-lg font-bold">Plans & Pricing</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-10">
          {/* Hero section */}
          <section className="text-center mb-12">
            <h2 className="text-4xl font-bold text-dash-foreground mb-3">
              Choose your plan
            </h2>
            <p className="text-dash-muted-foreground text-lg max-w-2xl mx-auto">
              All plans include access to your project workspace. Upgrade anytime to unlock advanced features and tools.
            </p>
          </section>

          {/* Plans grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {pricedPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border transition-all ${
                  plan.popular
                    ? "border-dash-accent/50 bg-dash-accent/5 shadow-lg shadow-dash-accent/10"
                    : "border-dash-border/50 bg-dash-card"
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-block bg-dash-accent/20 text-dash-accent text-xs font-semibold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 p-6">
                  <h3 className="text-xl font-bold text-dash-foreground mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-dash-muted-foreground text-sm mb-6">
                    {plan.description}
                  </p>

                  {/* Pricing */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-dash-foreground">
                        {plan.formattedPrice.amount}
                      </span>
                      <span className="text-dash-muted-foreground text-sm">
                        {plan.formattedPrice.currency}
                      </span>
                    </div>
                    <p className="text-dash-muted-foreground text-sm mt-2">
                      {plan.period}
                    </p>
                  </div>

                  {/* CTA */}
                  <Link
                    href={plan.ctaHref}
                    className={`block text-center px-4 py-3 rounded-lg font-semibold mb-6 transition-colors ${
                      plan.popular
                        ? "bg-dash-accent text-slate-950 hover:bg-dash-accent-dim"
                        : "border border-dash-border/50 text-dash-foreground hover:bg-dash-card/50"
                    }`}
                  >
                    {plan.cta}
                  </Link>

                  {/* Features */}
                  <div className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <span className="text-dash-accent flex-shrink-0 mt-1">✓</span>
                        <span className="text-dash-foreground/90">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Payment info */}
          <section className="bg-dash-card border border-dash-border/50 rounded-2xl p-8 mb-12">
            <h3 className="text-2xl font-bold text-dash-foreground mb-4">
              Flexible payment methods
            </h3>
            <p className="text-dash-muted-foreground mb-6">
              We accept mobile money through multiple providers in Tanzania:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PAYMENT_NETWORKS.map((network) => (
                <div
                  key={network}
                  className="border border-dash-border/50 rounded-lg px-4 py-3 text-center text-sm font-medium text-dash-foreground"
                >
                  {network}
                </div>
              ))}
            </div>
          </section>

          {/* FAQ section */}
          <section className="mb-12">
            <h3 className="text-2xl font-bold text-dash-foreground mb-6">
              Frequently asked questions
            </h3>
            <div className="space-y-4">
              {[
                {
                  q: "Can I change my plan anytime?",
                  a: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.",
                },
                {
                  q: "What happens if I exceed my storage quota?",
                  a: "You'll be notified when approaching your limit. Consider upgrading to get more storage, or archive older files.",
                },
                {
                  q: "Is there a contract or commitment?",
                  a: "No contracts. Monthly plans can be cancelled anytime. Semester and annual plans are billed upfront.",
                },
                {
                  q: "Do I get a refund if I cancel?",
                  a: "Refund eligibility depends on your subscription type and when you cancel. Contact support for details.",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="border border-dash-border/50 bg-dash-card/50 rounded-lg p-4"
                >
                  <h4 className="font-semibold text-dash-foreground mb-2">
                    {item.q}
                  </h4>
                  <p className="text-dash-muted-foreground text-sm">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA section */}
          <section className="bg-dash-accent/10 border border-dash-accent/20 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-dash-foreground mb-3">
              Ready to get started?
            </h3>
            <p className="text-dash-muted-foreground mb-6">
              Join thousands of students managing their projects with Honic Nexis.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href="/portal?auth=signup"
                className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim rounded-lg px-6 py-3 font-semibold transition-colors"
              >
                Start for free
              </Link>
              <Link
                href="/portal/payments"
                className="border border-dash-accent/50 text-dash-accent hover:bg-dash-accent/5 rounded-lg px-6 py-3 font-semibold transition-colors"
              >
                View subscriptions
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
