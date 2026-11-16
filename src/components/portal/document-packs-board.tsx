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
  PAID_PLAN_FILE_STORAGE_BYTES,
  PAYMENT_NETWORKS,
  PROJECT_DOCUMENTS_ACCESS_TSH,
  SUBSCRIPTION_SEMESTER_TSH,
  SUBSCRIPTION_YEAR_TSH,
  formatStorageQuota,
} from "@/lib/portal/config";

const PAID_STORAGE = formatStorageQuota(PAID_PLAN_FILE_STORAGE_BYTES);

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
    <div className="mx-auto max-w-6xl space-y-14 pb-10">
      <header className="relative overflow-hidden rounded-2xl border border-dash-border bg-dash-card px-4 py-6 sm:rounded-[1.75rem] sm:px-10 sm:py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 8% 20%, color-mix(in oklab, var(--dash-accent) 16%, transparent), transparent 58%), radial-gradient(ellipse 45% 55% at 92% 88%, color-mix(in oklab, var(--dash-foreground) 5%, transparent), transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--dash-accent)_55%,transparent)] to-transparent"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="max-w-2xl min-w-0">
            <p className="text-dash-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px] sm:tracking-[0.22em]">
              Honic Nexis
            </p>
            <h1 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">Plans & access</h1>
            <p className="text-dash-muted-foreground mt-3 text-sm leading-relaxed sm:text-base">
              Pick a Nexis Desk subscription for full portal access — including Jobs posting and applying. Select stays
              free. Pay or use a paid plan to hide and make a title yours. It is not a purchase of the idea.
            </p>
          </div>
          <div className="border-dash-border bg-dash-canvas/70 w-full min-w-0 max-w-full shrink-0 rounded-2xl border px-4 py-3 backdrop-blur-sm sm:max-w-xs lg:w-auto">
            <p className="text-dash-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">Your plan</p>
            <p className="text-dash-foreground mt-1 text-sm font-semibold break-words">{planLabel}</p>
            {planActive && deskExpiresAt ? (
              <p className="text-dash-muted-foreground mt-1 text-xs tabular-nums">
                {deskPlan === "semester" ? "Semester" : "Year"} · until{" "}
                {new Date(deskExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            ) : (
              <p className="text-dash-muted-foreground mt-1 text-xs">Upgrade below for free hides and full Nexis Desk tools.</p>
            )}
          </div>
        </div>
      </header>

      <section className="space-y-5">
        <div className="max-w-2xl">
          <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">Subscriptions</p>
          <h2 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight">Choose how you work</h2>
          <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">
            Compare free access with semester or full-year membership. Paid plans include {FREE_TITLE_SLOTS} free classmate
            hides, plus Jobs posting and applying.
          </p>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <FreePlanCard active={!planActive} />
          <SubscriptionCard
            planId="semester"
            name="Semester"
            period="6 months"
            price={SUBSCRIPTION_SEMESTER_TSH}
            perMonth={semesterPerMonth}
            points={[
              "Full Nexis Desk for one project cycle",
              "Workspace, Help desk, literature browse",
              "Jobs post, apply, and message",
              `${FREE_TITLE_SLOTS} free title hides included`,
              `File storage up to ${PAID_STORAGE}`,
              "Extend anytime; renewals stack",
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
              "Workspace, Help desk, literature browse",
              "Jobs post, apply, and message",
              `${FREE_TITLE_SLOTS} free title hides included`,
              `File storage up to ${PAID_STORAGE}`,
              `Save ${formatTsh(yearSave)} vs two semesters`,
            ]}
            signedIn={signedIn}
            phone={phone}
            active={planActive && deskPlan === "year"}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AddonCard
          eyebrow="Included on paid"
          title="Jobs board"
          body={PRICING_BOARD.jobs.note}
          price={null}
          note="Browse free · post and apply with semester or full-year Nexis Desk."
          action={
            <Link href="/portal/jobs" className="text-dash-accent text-sm font-semibold">
              Open Jobs →
            </Link>
          }
        />
        <AddonCard
          eyebrow="Add-on"
          title="Title hide"
          body="Pay to hide and make a shortlisted title yours. Classmates at your institution, course, and level cannot take it. Not a purchase of the idea; conflict protection for defence."
          price={EXTRA_TITLE_HIDE_FEE_TSH}
          note={`Per hide outside the ${FREE_TITLE_SLOTS} free on a paid plan. Free plan: every hide is paid.`}
          action={
            <Link href="/portal/titles" className="text-dash-accent text-sm font-semibold">
              Open literature review →
            </Link>
          }
        />
        <AddonCard
          eyebrow="Add-on"
          title="Project documents"
          body={PRICING_BOARD.projectDocuments.note}
          price={PROJECT_DOCUMENTS_ACCESS_TSH}
          note="One unlock for published study files on literature titles. View in browser after payment."
          action={
            signedIn ? (
              planActive ? (
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Included with your active Nexis Desk plan.
                </p>
              ) : (
                <DocumentsUnlockPanel phone={phone} compact />
              )
            ) : (
              <Link href="/portal" className="text-dash-accent text-sm font-semibold">
                Sign in to unlock →
              </Link>
            )
          }
        />
      </section>

      <section className="border-dash-border overflow-hidden rounded-[1.5rem] border bg-dash-card">
        <div className="border-dash-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <div>
            <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">How titles work</p>
            <h2 className="text-dash-foreground mt-0.5 text-lg font-semibold tracking-tight">Select, hide, and defend clearly</h2>
          </div>
          <p className="text-dash-muted-foreground max-w-sm text-xs leading-relaxed">
            Free to select · pay or paid plan to hide · not a purchase of the idea · conflict protection for defence
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "Select is free",
              d: "Keeps a title in front for you or with your partner. Classmates can still see it until it is hidden.",
            },
            {
              t: "Pay or paid plan",
              d: `Hide and make it yours. Free plan pays ${formatTsh(EXTRA_TITLE_HIDE_FEE_TSH)} per hide. Paid plan includes ${FREE_TITLE_SLOTS} free hides.`,
            },
            {
              t: "Not buying the idea",
              d: "Payment does not purchase the idea. It only activates classmate-hide protection on this portal.",
            },
            {
              t: "Conflict protection",
              d: "Hiding blocks others at your institution, course, and level so you can defend without conflict.",
            },
          ].map((item, i) => (
            <div
              key={item.t}
              className={`border-dash-border px-5 py-4 sm:px-6 ${i % 2 === 1 ? "sm:border-l" : ""} ${i >= 2 ? "lg:border-l" : ""} ${i >= 2 ? "border-t sm:border-t lg:border-t-0" : ""} ${i === 1 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-t lg:border-t-0" : ""}`}
            >
              <h3 className="text-dash-foreground text-sm font-semibold">{item.t}</h3>
              <p className="text-dash-muted-foreground mt-1.5 text-xs leading-relaxed">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-dashed border-dash-border px-5 py-6 sm:px-7">
          <h2 className="text-dash-foreground text-lg font-semibold">Always free</h2>
          <ul className="text-dash-muted-foreground mt-4 grid gap-2.5 text-sm">
            {PRICING_BOARD.freeAlways.map((line) => (
              <li key={line} className="flex gap-2.5">
                <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-dash-border bg-dash-card rounded-[1.5rem] border px-5 py-6 sm:px-7">
          <h2 className="text-dash-foreground text-lg font-semibold">Paid plan only</h2>
          <ul className="text-dash-muted-foreground mt-4 grid gap-2.5 text-sm">
            {PRICING_BOARD.paidOnly.map((line) => (
              <li key={line} className="flex gap-2.5">
                <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {PRICING_BOARD.packs.length ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-dash-foreground text-lg font-semibold">Optional writing packs</h2>
            <p className="text-dash-muted-foreground mt-1 text-sm">
              Guides from Honic writers. Not required for membership.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {PRICING_BOARD.packs.map((pack) => (
              <article key={pack.id} className="border-dash-border bg-dash-card rounded-2xl border p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-dash-foreground text-base font-semibold">{pack.name}</h3>
                  <p className="text-dash-foreground shrink-0 font-semibold tabular-nums">{formatTsh(pack.priceTsh)}</p>
                </div>
                <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">{pack.summary}</p>
                <ul className="text-dash-muted-foreground mt-3 space-y-1 text-sm">
                  {pack.includes.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FreePlanCard({ active }: { active: boolean }) {
  return (
    <article className="border-dash-border bg-dash-card relative flex flex-col rounded-[1.5rem] border p-5 transition duration-300 hover:-translate-y-0.5 hover:border-dash-foreground/20 sm:p-6">
      {active ? (
        <span className="bg-dash-muted text-dash-muted-foreground absolute top-4 right-4 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          Current
        </span>
      ) : null}
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">Always available</p>
      <h3 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight">Free plan</h3>
      <p className="text-dash-foreground mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">TSh 0</span>
      </p>
      <p className="text-dash-muted-foreground mt-1 text-xs">Browse and select titles anytime</p>
      <ul className="text-dash-muted-foreground mt-6 flex-1 space-y-2.5 text-sm leading-relaxed">
        {[
          "Literature review browse",
          "Select titles for free (keep in front)",
          "Browse Jobs listings",
          "Pay per hide to make a title yours",
          "No Help desk · no Jobs post/apply/message",
        ].map((p) => (
          <li key={p} className="flex gap-2.5">
            <CheckIcon className="text-dash-muted-foreground mt-0.5 shrink-0 opacity-70" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/portal/titles"
        className="border-dash-border text-dash-foreground mt-6 inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-dash-muted"
      >
        Browse literature
      </Link>
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
      className={`relative flex flex-col overflow-hidden rounded-[1.5rem] border p-5 transition duration-300 hover:-translate-y-0.5 sm:p-6 ${
        highlight
          ? "border-dash-accent/40 bg-dash-card shadow-[0_18px_50px_-28px_color-mix(in_oklab,var(--dash-accent)_55%,transparent)] ring-1 ring-dash-accent/25"
          : "border-dash-border bg-dash-card hover:border-dash-foreground/20"
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
      <h3 className="text-dash-foreground mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{name}</h3>
      <p className="text-dash-foreground mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{formatTsh(price)}</span>
        <span className="text-dash-muted-foreground text-xs tabular-nums">≈ {formatTsh(perMonth)} / month</span>
      </p>
      {active ? (
        <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Currently active on your account</p>
      ) : (
        <p className="text-dash-muted-foreground mt-2 text-xs">Mobile money via Snippe · activates after confirmation</p>
      )}

      <ul className="text-dash-muted-foreground mt-6 flex-1 space-y-2.5 text-sm leading-relaxed">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5">
            <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      {!open ? (
        <button
          type="button"
          disabled={!signedIn}
          onClick={() => {
            setOpen(true);
            setStatus(null);
          }}
          className={`${PRIMARY} mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {active ? "Renew securely" : `Subscribe · ${formatTsh(price)}`}
        </button>
      ) : (
        <form
          className="border-dash-border mt-6 grid gap-3 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            pay(new FormData(e.currentTarget));
          }}
        >
          <p className="text-dash-foreground text-sm font-semibold">Secure checkout · {formatTsh(price)}</p>
          <Field label="Pay with">
            <select name="network" className={INPUT} defaultValue={PAYMENT_NETWORKS[0]}>
              {PAYMENT_NETWORKS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="Mobile money number">
            <input name="phone" required className={INPUT} defaultValue={phone} placeholder="07XX XXX XXX" />
          </Field>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" className={`${SECONDARY} w-full`} onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className={`${PRIMARY} w-full`} disabled={pending}>
              {pending ? "Subscribing…" : active ? "Pay to renew" : "Subscribe"}
            </button>
          </div>
          {status ? <StatusText status={status} /> : null}
        </form>
      )}

      {!signedIn ? (
        <Link href="/portal" className="text-dash-accent mt-3 text-center text-xs font-semibold">
          Sign in first →
        </Link>
      ) : (
        <p className="text-dash-muted-foreground mt-3 text-center text-[11px] leading-relaxed">
          Activates only after verified payment
        </p>
      )}
    </article>
  );
}

function AddonCard({
  eyebrow,
  title,
  body,
  price,
  note,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string;
  price: number | null;
  note: string;
  action?: ReactNode;
}) {
  return (
    <article className="border-dash-border bg-dash-card flex flex-col rounded-[1.5rem] border p-5 sm:p-6">
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">{eyebrow}</p>
      <h2 className="text-dash-foreground mt-1 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="text-dash-muted-foreground mt-3 flex-1 text-sm leading-relaxed">{body}</p>
      <p className="text-dash-foreground mt-5 text-3xl font-semibold tracking-tight tabular-nums">
        {price == null ? "Included" : formatTsh(price)}
      </p>
      <p className="text-dash-muted-foreground mt-1 text-sm">{note}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </article>
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
