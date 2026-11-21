"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { portalPayForMembershipAction, type PortalResult } from "@/app/portal/actions";
import { DocumentsUnlockPanel } from "@/components/portal/documents-unlock-panel";
import { Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { formatTsh, PRICING_BOARD } from "@/lib/portal/document-packs";
import {
  EXTRA_TITLE_HIDE_FEE_TSH,
  FREE_TITLE_SLOTS,
  MAX_MEMBERSHIP_MONTHS,
  PAID_PLAN_FILE_STORAGE_BYTES,
  PAYMENT_NETWORKS,
  PROJECT_DOCUMENTS_ACCESS_TSH,
  SUBSCRIPTION_MONTH_TSH,
  SUBSCRIPTION_SEMESTER_TSH,
  SUBSCRIPTION_YEAR_TSH,
  formatStorageQuota,
} from "@/lib/portal/config";

const PAID_STORAGE = formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES);

const SECTION = "mx-auto w-full max-w-7xl px-6 py-8";
const EYEBROW = "text-dash-accent text-[11px] font-semibold tracking-[0.2em] uppercase";

export function DocumentPacksBoard({
  signedIn,
  planActive = false,
  planLabel = "Free plan",
  phone = "",
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
    <div className="bg-dash-canvas text-dash-foreground min-h-screen flex flex-col">
      {/* Header section */}
      <section className="border-b border-dash-border/50 py-10 sm:py-14">
        <div className={SECTION}>
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-dash-foreground mb-2">
              Plans & access
            </h1>
            <p className="text-dash-muted-foreground text-lg max-w-2xl">
              Choose a plan that fits your project timeline. Upgrade anytime to unlock full workspace tools and collaboration features.
            </p>
          </div>

          {/* Current plan status */}
          <div className="inline-flex items-center gap-3 border border-dash-border/50 bg-dash-card/50 rounded-lg px-4 py-3">
            <span
              className={`h-2 w-2 rounded-full ${planActive ? "bg-emerald-400" : "bg-amber-300"}`}
              aria-hidden
            />
            <p className="text-sm">
              <span className="font-semibold text-dash-foreground">Current plan:</span>
              <span className="ml-2 text-dash-muted-foreground">{planLabel}</span>
            </p>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="scroll-mt-24 pt-14 sm:pt-20">
        <div className={SECTION}>
          <div className="max-w-2xl">
            <p className={EYEBROW}>Plans</p>
            <h2 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Pick the length that fits your project
            </h2>
            <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">
              Every paid plan includes {FREE_TITLE_SLOTS} free classmate hides and peer-help posting. Renewals stack on
              your current expiry, so you never lose days.
            </p>
          </div>

          <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
            <FreePlanCard active={!planActive} />
            <MonthlyPlanCard signedIn={signedIn} phone={phone} active={planActive && deskPlan === "monthly"} />
            <SubscriptionPlanCard
              planId="semester"
              name="Semester"
              period="6 months"
              price={SUBSCRIPTION_SEMESTER_TSH}
              perMonth={semesterPerMonth}
              points={[
                "Full Nexis Desk for one project cycle",
                "Workspace, help desk, literature",
                "Peer help post, offer, and message",
                `${FREE_TITLE_SLOTS} free title hides`,
                `Storage up to ${PAID_STORAGE}`,
              ]}
              signedIn={signedIn}
              phone={phone}
              active={planActive && deskPlan === "semester"}
            />
            <SubscriptionPlanCard
              planId="year"
              name="Full year"
              period="12 months"
              price={SUBSCRIPTION_YEAR_TSH}
              perMonth={yearPerMonth}
              badge="Best value"
              highlight
              points={[
                "Full Nexis Desk for the academic year",
                "Workspace, help desk, literature",
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

      {/* What paid unlocks */}
      <section className="pt-16 sm:pt-24">
        <div className={SECTION}>
          <p className={EYEBROW}>What you get</p>
          <h2 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything a paid plan opens
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <FeatureTile
              title="Peer help"
              body={PRICING_BOARD.jobs.note}
              action={<Link href="/portal/jobs" className="text-dash-accent text-sm font-semibold">Open peer help →</Link>}
            />
            <FeatureTile
              title="Title hides"
              body={`${formatTsh(EXTRA_TITLE_HIDE_FEE_TSH)} per hide outside the ${FREE_TITLE_SLOTS} included on a paid plan.`}
              action={<Link href="/portal/titles" className="text-dash-accent text-sm font-semibold">Open literature →</Link>}
            />
            <FeatureTile
              title="Project documents"
              body={
                planActive
                  ? "Included with your active plan."
                  : `${formatTsh(PROJECT_DOCUMENTS_ACCESS_TSH)} to unlock, or included on any paid plan.`
              }
              action={
                signedIn && !planActive ? (
                  <div className="mt-1">
                    <DocumentsUnlockPanel phone={phone} compact />
                  </div>
                ) : !signedIn ? (
                  <Link href="/portal" className="text-dash-accent text-sm font-semibold">Sign in to unlock →</Link>
                ) : null
              }
            />
          </div>
        </div>
      </section>

      {/* Free vs paid */}
      <section className="pt-16 sm:pt-24">
        <div className={SECTION}>
          <div className="grid gap-5 md:grid-cols-2">
            <ChecklistPanel title="Always free" items={PRICING_BOARD.freeAlways} />
            <ChecklistPanel title="Paid plan only" items={PRICING_BOARD.paidOnly} highlight />
          </div>
        </div>
      </section>

      {/* Title rules */}
      <section className="pt-16 sm:pt-24">
        <div className={SECTION}>
          <div className="rounded-3xl border border-dash-border bg-dash-card p-6 sm:p-10">
            <p className={EYEBROW}>How titles work</p>
            <h2 className="text-dash-foreground mt-2 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
              Selecting is free. Hiding protects your group.
            </h2>
            <p className="text-dash-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
              Hiding is not buying the idea. It keeps a title from classmates at your institution, course, and level
              until defence.
            </p>
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: "1", t: "Select free", d: "Keeps a title in front. Classmates can still see it until it is hidden." },
                { n: "2", t: "Hide when ready", d: `Free plan pays ${formatTsh(EXTRA_TITLE_HIDE_FEE_TSH)} per hide. Paid plans include ${FREE_TITLE_SLOTS}.` },
                { n: "3", t: "Not a title shop", d: "Payment only activates classmate-hide protection on this portal." },
                { n: "4", t: "Defend clearly", d: "Hiding blocks others at your institution, course, and level." },
              ].map((item) => (
                <li key={item.n} className="relative pl-12">
                  <span className="bg-dash-accent/10 text-dash-accent absolute top-0 left-0 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                    {item.n}
                  </span>
                  <h3 className="text-dash-foreground text-base font-semibold">{item.t}</h3>
                  <p className="text-dash-muted-foreground mt-1.5 text-sm leading-relaxed">{item.d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <Link href="/portal/titles" className={`${SECONDARY} inline-flex`}>
                Open literature review
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Optional packs */}
      {PRICING_BOARD.packs.length ? (
        <section className="pt-16 sm:pt-24">
          <div className={SECTION}>
            <p className={EYEBROW}>Optional</p>
            <h2 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Writing packs</h2>
            <p className="text-dash-muted-foreground mt-2 text-sm">
              Guides from Honic writers. Not required for membership.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {PRICING_BOARD.packs.map((pack) => (
                <article key={pack.id} className="border-dash-border bg-dash-card rounded-2xl border p-6">
                  <div className="flex items-start justify-between gap-4">
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

function PlanShell({
  eyebrow,
  name,
  price,
  priceNote,
  badge,
  active,
  highlight,
  children,
  footer,
}: {
  eyebrow: string;
  name: string;
  price: string;
  priceNote?: string;
  badge?: string;
  active?: boolean;
  highlight?: boolean;
  children?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <article
      className={`relative flex flex-col rounded-3xl border p-6 transition duration-300 hover:-translate-y-0.5 sm:p-7 ${
        highlight
          ? "border-dash-accent/50 bg-dash-card shadow-[0_30px_70px_-35px_color-mix(in_oklab,var(--dash-accent)_55%,transparent)] ring-1 ring-dash-accent/25"
          : "border-dash-border bg-dash-card"
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="text-dash-muted-foreground min-w-0 truncate text-[11px] font-semibold tracking-[0.18em] uppercase">{eyebrow}</p>
        {badge ? (
          <span className="bg-dash-accent shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
            {badge}
          </span>
        ) : active ? (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 uppercase dark:text-emerald-200">
            Active
          </span>
        ) : null}
      </div>
      <h3 className="text-dash-foreground mt-3 text-2xl font-semibold tracking-tight">{name}</h3>
      <p className="text-dash-foreground mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-semibold tracking-tight whitespace-nowrap tabular-nums">{price}</span>
        {priceNote ? <span className="text-dash-muted-foreground text-xs tabular-nums">{priceNote}</span> : null}
      </p>
      {children}
      <div className="mt-auto pt-6">{footer}</div>
    </article>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="text-dash-muted-foreground mt-6 space-y-2.5 text-sm leading-relaxed">
      {items.map((p) => (
        <li key={p} className="flex gap-2.5">
          <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

function FreePlanCard({ active }: { active: boolean }) {
  return (
    <PlanShell
      eyebrow="Start here"
      name="Free"
      price="TSh 0"
      priceNote="Browse and select anytime"
      active={active}
      footer={
        <Link href="/portal/titles" className={`${SECONDARY} w-full`}>
          Browse literature
        </Link>
      }
    >
      <FeatureList items={["Literature review browse", "Select titles for free", "Browse peer help", "Pay per hide when you need it"]} />
    </PlanShell>
  );
}

function MonthlyPlanCard({ signedIn, phone, active }: { signedIn: boolean; phone: string; active?: boolean }) {
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
    <PlanShell
      eyebrow="Stack months"
      name="Monthly"
      price={formatTsh(price)}
      priceNote={`${formatTsh(SUBSCRIPTION_MONTH_TSH)} × ${months}`}
      active={active}
      footer={
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
      }
    >
      <div className="mt-4">
        <Field label="How many months?">
          <select className={INPUT} value={months} onChange={(e) => setMonths(Number(e.target.value))} disabled={open && pending}>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m} {m === 1 ? "month" : "months"} · {formatTsh(SUBSCRIPTION_MONTH_TSH * m)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <FeatureList items={["Full Nexis Desk tools", "Peer help post and offer", `${FREE_TITLE_SLOTS} free title hides`, `Storage up to ${PAID_STORAGE}`]} />
    </PlanShell>
  );
}

function SubscriptionPlanCard({
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
    <PlanShell
      eyebrow={period}
      name={name}
      price={formatTsh(price)}
      priceNote={`≈ ${formatTsh(perMonth)} / mo`}
      badge={badge}
      active={active}
      highlight={highlight}
      footer={
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
      }
    >
      <FeatureList items={points} />
    </PlanShell>
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
          className={`${PRIMARY} w-full whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {ctaIdle}
        </button>
        {!signedIn ? (
          <Link href="/portal" className="text-dash-accent mt-3 block text-center text-xs font-semibold">
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
      className="border-dash-border grid gap-3 border-t pt-5"
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

function ChecklistPanel({ title, items, highlight }: { title: string; items: readonly string[]; highlight?: boolean }) {
  return (
    <div
      className={`rounded-3xl border p-6 sm:p-8 ${
        highlight ? "border-dash-accent/40 bg-dash-card" : "border-dash-border bg-dash-muted/40"
      }`}
    >
      <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">{title}</h2>
      <ul className="text-dash-muted-foreground mt-5 space-y-3 text-sm leading-relaxed">
        {items.map((line) => (
          <li key={line} className="flex gap-3">
            <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureTile({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="border-dash-border bg-dash-card flex flex-col rounded-2xl border p-6">
      <h3 className="text-dash-foreground text-base font-semibold">{title}</h3>
      <p className="text-dash-muted-foreground mt-2 flex-1 text-sm leading-relaxed">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 ${className ?? ""}`} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
