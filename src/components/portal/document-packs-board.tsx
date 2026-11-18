"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalPayForMembershipAction, type PortalResult } from "@/app/portal/actions";
import { DocumentsUnlockPanel } from "@/components/portal/documents-unlock-panel";
import { Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { formatTsh, PRICING_BOARD } from "@/lib/portal/document-packs";
import {
  EXTRA_TITLE_HIDE_FEE_TSH,
  FREE_TITLE_SLOTS,
  PAID_PLAN_FILE_STORAGE_BYTES,
  PAYMENT_NETWORKS,
  PROJECT_DOCUMENTS_ACCESS_TSH,
  MAX_MEMBERSHIP_MONTHS,
  SUBSCRIPTION_MONTH_TSH,
  SUBSCRIPTION_SEMESTER_TSH,
  SUBSCRIPTION_YEAR_TSH,
  formatStorageQuota,
} from "@/lib/portal/config";

const PAID_STORAGE = formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES);

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=80";

export function DocumentPacksBoard({
  signedIn,
  planActive = false,
  planLabel = "Free plan",
  phone = "",
  deskExpiresAt = null,
  deskPlan = null,
}: {
  signedIn: boolean;
  planActive?: boolean;
  planLabel?: string;
  phone?: string;
  deskExpiresAt?: string | null;
  deskPlan?: string | null;
}) {
  const yearSave = SUBSCRIPTION_SEMESTER_TSH * 2 - SUBSCRIPTION_YEAR_TSH;
  const yearPerMonth = Math.round(SUBSCRIPTION_YEAR_TSH / 12);
  const semesterPerMonth = Math.round(SUBSCRIPTION_SEMESTER_TSH / 6);

  return (
    <div className="packs-site -mx-3 sm:-mx-6 lg:-mx-8">
      <style jsx>{`
        .packs-site :global(.packs-fade) {
          animation: packsFadeUp 0.7s ease-out both;
        }
        .packs-site :global(.packs-fade-delay) {
          animation: packsFadeUp 0.8s ease-out 0.12s both;
        }
        .packs-site :global(.packs-fade-delay-2) {
          animation: packsFadeUp 0.85s ease-out 0.22s both;
        }
        @keyframes packsFadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Full-bleed hero — one composition */}
      <section className="relative min-h-[min(72vh,36rem)] overflow-hidden">
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
              "linear-gradient(105deg, color-mix(in oklab, #0f172a 88%, transparent) 0%, color-mix(in oklab, #0f172a 72%, transparent) 48%, color-mix(in oklab, #0f172a 42%, transparent) 100%), radial-gradient(ellipse 60% 70% at 85% 20%, color-mix(in oklab, #06b6d4 35%, transparent), transparent 55%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[min(72vh,36rem)] max-w-6xl flex-col justify-end px-4 pb-12 pt-16 sm:px-8 sm:pb-16 lg:px-10">
          <p className="packs-fade text-[11px] font-semibold tracking-[0.28em] text-cyan-200/90 uppercase sm:text-xs">
            Honic Nexis
          </p>
          <h1 className="packs-fade-delay mt-3 max-w-xl text-4xl leading-[1.05] font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your desk. Your pace.
          </h1>
          <p className="packs-fade-delay-2 mt-4 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
            Choose a Nexis Desk plan for workspace tools, peer help, and free title hides — paid with mobile money.
          </p>
          <div className="packs-fade-delay-2 mt-8 flex flex-wrap gap-3">
            <a
              href="#plans"
              className="bg-dash-accent inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
            >
              See plans
            </a>
            <Link
              href="/portal/titles"
              className="inline-flex items-center justify-center rounded-md border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Browse literature
            </Link>
          </div>
        </div>
      </section>

      {/* Current status strip — outside hero */}
      <div className="border-dash-border bg-dash-card/90 border-b px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p className="text-dash-muted-foreground text-sm">
            <span className="text-dash-foreground font-semibold">Your access · </span>
            {planLabel}
          </p>
          {planActive && deskExpiresAt ? (
            <p className="text-dash-muted-foreground text-xs tabular-nums">
              {deskPlan === "semester"
                ? "Semester"
                : deskPlan === "monthly"
                  ? "Monthly"
                  : deskPlan === "year"
                    ? "Year"
                    : "Paid"}{" "}
              · until{" "}
              {new Date(deskExpiresAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          ) : (
            <p className="text-dash-muted-foreground text-xs">Select titles free · hide when you are ready</p>
          )}
        </div>
      </div>

      {/* Plans */}
      <section id="plans" className="relative scroll-mt-24 px-4 py-14 sm:px-8 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 40% at 50% 0%, color-mix(in oklab, var(--dash-accent) 12%, transparent), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-dash-foreground text-3xl font-semibold tracking-tight sm:text-4xl">Choose how you work</h2>
            <p className="text-dash-muted-foreground mt-3 text-sm leading-relaxed sm:text-base">
              Monthly, semester, or full year. Paid plans include {FREE_TITLE_SLOTS} free classmate hides and peer-help
              posting.
            </p>
          </div>

          <div className="mt-10 grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <FreePlanCard active={!planActive} />
            <MonthlySubscriptionCard signedIn={signedIn} phone={phone} active={planActive && deskPlan === "monthly"} />
            <SubscriptionCard
              planId="semester"
              name="Semester"
              period="6 months"
              price={SUBSCRIPTION_SEMESTER_TSH}
              perMonth={semesterPerMonth}
              points={[
                "Full Nexis Desk for one project cycle",
                "Workspace, Help desk, literature",
                "Peer help post, offer, and message",
                `${FREE_TITLE_SLOTS} free title hides`,
                `Storage up to ${PAID_STORAGE}`,
                "Renewals stack on your expiry",
              ]}
              signedIn={signedIn}
              phone={phone}
              active={planActive && deskPlan === "semester"}
            />
            <SubscriptionCard
              planId="year"
              name="Full year"
              period="12 months"
              price={SUBSCRIPTION_YEAR_TSH}
              perMonth={yearPerMonth}
              badge="Best value"
              highlight
              points={[
                "Full Nexis Desk for the academic year",
                "Workspace, Help desk, literature",
                "Peer help post, offer, and message",
                `${FREE_TITLE_SLOTS} free title hides`,
                `Storage up to ${PAID_STORAGE}`,
                `Save ${formatTsh(yearSave)} vs two semesters`,
              ]}
              signedIn={signedIn}
              phone={phone}
              active={planActive && deskPlan === "year"}
            />
          </div>
        </div>
      </section>

      {/* How titles work — one purpose */}
      <section className="border-dash-border bg-dash-card border-y px-4 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-dash-foreground text-2xl font-semibold tracking-tight sm:text-3xl">How titles work</h2>
          <p className="text-dash-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            Select stays free. Hiding protects your defence group — it is not buying the idea.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                t: "Select free",
                d: "Keeps a title in front. Classmates can still see it until it is hidden.",
              },
              {
                n: "02",
                t: "Hide when ready",
                d: `Free plan pays ${formatTsh(EXTRA_TITLE_HIDE_FEE_TSH)} per hide. Paid plans include ${FREE_TITLE_SLOTS} free hides.`,
              },
              {
                n: "03",
                t: "Not a title shop",
                d: "Payment only activates classmate-hide protection on this portal.",
              },
              {
                n: "04",
                t: "Defend clearly",
                d: "Hiding blocks others at your institution, course, and level.",
              },
            ].map((item) => (
              <li key={item.n} className="relative">
                <p className="text-dash-accent font-mono text-sm tracking-wider">{item.n}</p>
                <h3 className="text-dash-foreground mt-2 text-lg font-semibold">{item.t}</h3>
                <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">{item.d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Link
              href="/portal/titles"
              className="text-dash-accent inline-flex text-sm font-semibold underline-offset-4 hover:underline"
            >
              Open literature review →
            </Link>
          </div>
        </div>
      </section>

      {/* Included tools — one strip, not three promo cards */}
      <section className="px-4 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-dash-foreground text-2xl font-semibold tracking-tight sm:text-3xl">What paid unlocks</h2>
          <p className="text-dash-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            Peer help, Help desk, and more storage come with any active Nexis Desk plan.
          </p>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            <div>
              <h3 className="text-dash-foreground text-base font-semibold">Peer help</h3>
              <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">{PRICING_BOARD.jobs.note}</p>
              <Link href="/portal/jobs" className="text-dash-accent mt-3 inline-flex text-sm font-semibold">
                Open peer help →
              </Link>
            </div>
            <div>
              <h3 className="text-dash-foreground text-base font-semibold">Title hide</h3>
              <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">
                {formatTsh(EXTRA_TITLE_HIDE_FEE_TSH)} per hide outside the {FREE_TITLE_SLOTS} free on a paid plan.
              </p>
              <Link href="/portal/titles" className="text-dash-accent mt-3 inline-flex text-sm font-semibold">
                Open literature →
              </Link>
            </div>
            <div>
              <h3 className="text-dash-foreground text-base font-semibold">Project documents</h3>
              <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">
                {planActive
                  ? "Included with your active plan."
                  : `${formatTsh(PROJECT_DOCUMENTS_ACCESS_TSH)} unlock, or included on paid Desk.`}
              </p>
              {signedIn && !planActive ? (
                <div className="mt-3">
                  <DocumentsUnlockPanel phone={phone} compact />
                </div>
              ) : !signedIn ? (
                <Link href="/portal" className="text-dash-accent mt-3 inline-flex text-sm font-semibold">
                  Sign in to unlock →
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Free vs paid — clean comparison */}
      <section className="border-dash-border bg-dash-muted/40 border-t px-4 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-dash-foreground text-xl font-semibold tracking-tight">Always free</h2>
            <ul className="text-dash-muted-foreground mt-5 space-y-3 text-sm leading-relaxed">
              {PRICING_BOARD.freeAlways.map((line) => (
                <li key={line} className="flex gap-3">
                  <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-dash-foreground text-xl font-semibold tracking-tight">Paid plan only</h2>
            <ul className="text-dash-muted-foreground mt-5 space-y-3 text-sm leading-relaxed">
              {PRICING_BOARD.paidOnly.map((line) => (
                <li key={line} className="flex gap-3">
                  <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {PRICING_BOARD.packs.length ? (
        <section className="border-dash-border border-t px-4 py-14 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-dash-foreground text-xl font-semibold">Optional writing packs</h2>
            <p className="text-dash-muted-foreground mt-1 text-sm">Guides from Honic writers. Not required for membership.</p>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              {PRICING_BOARD.packs.map((pack) => (
                <article key={pack.id} className="border-dash-border border-t pt-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-dash-foreground text-base font-semibold">{pack.name}</h3>
                    <p className="text-dash-foreground shrink-0 font-semibold tabular-nums">{formatTsh(pack.priceTsh)}</p>
                  </div>
                  <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">{pack.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FreePlanCard({ active }: { active: boolean }) {
  return (
    <article className="border-dash-border bg-dash-card relative flex flex-col rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 sm:p-6">
      {active ? (
        <span className="bg-dash-muted text-dash-muted-foreground absolute top-4 right-4 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          Current
        </span>
      ) : null}
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">Always available</p>
      <h3 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight">Free</h3>
      <p className="text-dash-foreground mt-4 text-4xl font-semibold tracking-tight tabular-nums">TSh 0</p>
      <p className="text-dash-muted-foreground mt-1 text-xs">Browse and select anytime</p>
      <ul className="text-dash-muted-foreground mt-6 flex-1 space-y-2.5 text-sm leading-relaxed">
        {[
          "Literature review browse",
          "Select titles for free",
          "Browse peer help",
          "Pay per hide when you need it",
        ].map((p) => (
          <li key={p} className="flex gap-2.5">
            <CheckIcon className="text-dash-muted-foreground mt-0.5 shrink-0 opacity-70" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/portal/titles"
        className="border-dash-border text-dash-foreground mt-6 inline-flex w-full items-center justify-center rounded-md border px-4 py-2.5 text-sm font-semibold transition hover:bg-dash-muted"
      >
        Browse literature
      </Link>
    </article>
  );
}

function MonthlySubscriptionCard({
  signedIn,
  phone,
  active,
}: {
  signedIn: boolean;
  phone: string;
  active?: boolean;
}) {
  const router = useRouter();
  const [months, setMonths] = useState(1);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const price = SUBSCRIPTION_MONTH_TSH * months;
  const monthOptions = Array.from({ length: MAX_MEMBERSHIP_MONTHS }, (_, i) => i + 1);

  function pay(fd: FormData) {
    setStatus(null);
    startTransition(async () => {
      const res = await portalPayForMembershipAction(
        "monthly",
        String(fd.get("network") ?? ""),
        String(fd.get("phone") ?? ""),
        months,
      );
      setStatus(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <article className="border-dash-border bg-dash-card relative flex flex-col overflow-hidden rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 sm:p-6">
      {active ? (
        <span className="absolute top-4 right-4 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 uppercase dark:text-emerald-200">
          Active
        </span>
      ) : null}
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">Stack months</p>
      <h3 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight">Monthly</h3>
      <p className="text-dash-foreground mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatTsh(price)}</span>
        <span className="text-dash-muted-foreground text-xs tabular-nums">
          {formatTsh(SUBSCRIPTION_MONTH_TSH)} × {months}
        </span>
      </p>
      <div className="mt-4">
        <Field label="How many months?">
          <select
            className={INPUT}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            disabled={open && pending}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "month" : "months"} · {formatTsh(SUBSCRIPTION_MONTH_TSH * m)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ul className="text-dash-muted-foreground mt-6 flex-1 space-y-2.5 text-sm leading-relaxed">
        {[
          "Full Nexis Desk tools",
          "Peer help post and offer",
          `${FREE_TITLE_SLOTS} free title hides`,
          `Storage up to ${PAID_STORAGE}`,
        ].map((p) => (
          <li key={p} className="flex gap-2.5">
            <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <CheckoutBlock
        open={open}
        setOpen={setOpen}
        signedIn={signedIn}
        pending={pending}
        status={status}
        phone={phone}
        active={active}
        priceLabel={formatTsh(price)}
        onPay={pay}
        ctaIdle={active ? "Extend securely" : `Subscribe · ${formatTsh(price)}`}
      />
    </article>
  );
}

function SubscriptionCard({
  planId,
  name,
  price,
  period,
  perMonth,
  points,
  highlight,
  badge,
  signedIn,
  phone,
  active,
}: {
  planId: "year" | "semester";
  name: string;
  price: number;
  period: string;
  perMonth: number;
  points: string[];
  highlight?: boolean;
  badge?: string;
  signedIn: boolean;
  phone: string;
  active?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  function pay(fd: FormData) {
    setStatus(null);
    startTransition(async () => {
      const res = await portalPayForMembershipAction(planId, String(fd.get("network") ?? ""), String(fd.get("phone") ?? ""));
      setStatus(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 sm:p-6 ${
        highlight
          ? "border-dash-accent/45 bg-dash-card ring-dash-accent/20 shadow-[0_24px_60px_-32px_color-mix(in_oklab,var(--dash-accent)_50%,transparent)] ring-1"
          : "border-dash-border bg-dash-card"
      }`}
    >
      {highlight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-dash-accent to-transparent"
        />
      ) : null}
      {badge ? (
        <span className="bg-dash-accent absolute top-4 right-4 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
          {badge}
        </span>
      ) : null}
      {active && !badge ? (
        <span className="absolute top-4 right-4 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 uppercase dark:text-emerald-200">
          Active
        </span>
      ) : null}
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">{period}</p>
      <h3 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight">{name}</h3>
      <p className="text-dash-foreground mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatTsh(price)}</span>
        <span className="text-dash-muted-foreground text-xs tabular-nums">≈ {formatTsh(perMonth)} / mo</span>
      </p>
      <ul className="text-dash-muted-foreground mt-6 flex-1 space-y-2.5 text-sm leading-relaxed">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5">
            <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <CheckoutBlock
        open={open}
        setOpen={setOpen}
        signedIn={signedIn}
        pending={pending}
        status={status}
        phone={phone}
        active={active}
        priceLabel={formatTsh(price)}
        onPay={pay}
        ctaIdle={active ? "Renew securely" : `Subscribe · ${formatTsh(price)}`}
      />
    </article>
  );
}

function CheckoutBlock({
  open,
  setOpen,
  signedIn,
  pending,
  status,
  phone,
  active,
  priceLabel,
  onPay,
  ctaIdle,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  signedIn: boolean;
  pending: boolean;
  status: PortalResult | null;
  phone: string;
  active?: boolean;
  priceLabel: string;
  onPay: (fd: FormData) => void;
  ctaIdle: string;
}) {
  if (!open) {
    return (
      <>
        <button
          type="button"
          disabled={!signedIn}
          onClick={() => setOpen(true)}
          className={`${PRIMARY} mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {ctaIdle}
        </button>
        {!signedIn ? (
          <Link href="/portal" className="text-dash-accent mt-3 text-center text-xs font-semibold">
            Sign in first →
          </Link>
        ) : (
          <p className="text-dash-muted-foreground mt-3 text-center text-[11px]">Activates after verified payment</p>
        )}
      </>
    );
  }

  return (
    <form
      className="border-dash-border mt-6 grid gap-3 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        onPay(new FormData(e.currentTarget));
      }}
    >
      <p className="text-dash-foreground text-sm font-semibold">
        Secure checkout · {priceLabel}
        {active ? " · renew" : ""}
      </p>
      <Field label="Pay with">
        <select name="network" className={INPUT} defaultValue={PAYMENT_NETWORKS[0]}>
          {PAYMENT_NETWORKS.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </Field>
      <Field label="Mobile money number">
        <input name="phone" required type="tel" className={INPUT} defaultValue={phone} placeholder="07XX XXX XXX" autoComplete="tel" />
      </Field>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" className={`${SECONDARY} w-full`} onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className={`${PRIMARY} w-full`} disabled={pending}>
          {pending ? "Sending…" : active ? "Pay to renew" : "Pay now"}
        </button>
      </div>
      {status ? <StatusText status={status} /> : null}
    </form>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 ${className ?? ""}`} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
