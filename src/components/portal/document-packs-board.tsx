"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import {
  portalCheckMembershipPaymentAction,
  portalPayForMembershipAction,
  type PortalResult,
} from "@/app/portal/actions";
import { DocumentsUnlockPanel } from "@/components/portal/documents-unlock-panel";
import { Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { formatTsh, PRICING_BOARD } from "@/lib/portal/document-packs";
import {
  EXTRA_TITLE_HIDE_FEE_TSH,
  FREE_TITLE_SLOTS,
  MAX_MEMBERSHIP_MONTHS,
  MONTHLY_PLAN_FILE_STORAGE_BYTES,
  PAYMENT_NETWORKS,
  PROJECT_DOCUMENTS_ACCESS_TSH,
  SEMESTER_PLAN_FILE_STORAGE_BYTES,
  SUBSCRIPTION_MONTH_TSH,
  SUBSCRIPTION_SEMESTER_TSH,
  SUBSCRIPTION_YEAR_TSH,
  YEAR_PLAN_FILE_STORAGE_BYTES,
  formatStorageQuota,
} from "@/lib/portal/config";

const MONTHLY_STORAGE = formatStorageQuota(MONTHLY_PLAN_FILE_STORAGE_BYTES);
const SEMESTER_STORAGE = formatStorageQuota(SEMESTER_PLAN_FILE_STORAGE_BYTES);
const YEAR_STORAGE = formatStorageQuota(YEAR_PLAN_FILE_STORAGE_BYTES);

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=80";

const SECTION = "mx-auto w-full max-w-6xl px-4 sm:px-8";
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
  const yearPerMonth = Math.round(SUBSCRIPTION_YEAR_TSH / 12);
  const semesterPerMonth = Math.round(SUBSCRIPTION_SEMESTER_TSH / 6);

  const yearPoints = [
    "Full Nexis Desk for the academic year",
    "Workspace, help desk, final year titles",
    "Peer help post, offer, and message",
    `${FREE_TITLE_SLOTS} free title hides`,
    `Storage up to ${YEAR_STORAGE}`,
    `${YEAR_STORAGE} vs ${SEMESTER_STORAGE} on semester`,
  ];
  const semesterPoints = [
    "Full Nexis Desk for one project cycle",
    "Workspace, help desk, final year titles",
    "Peer help post, offer, and message",
    `${FREE_TITLE_SLOTS} free title hides`,
    `Storage up to ${SEMESTER_STORAGE}`,
  ];

  return (
    <div className="packs-site -mx-3 -mt-4 pb-24 sm:-mx-6 sm:-mt-5 sm:pb-16 lg:-mx-8">
      {/* Phone-first hero: one composition, brand + one line + CTA */}
      <section className="packs-hero relative overflow-hidden bg-slate-950">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-[center_30%] opacity-45 sm:opacity-40"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(2,6,23,0.45) 0%, rgba(2,6,23,0.88) 70%, rgba(2,6,23,0.98) 100%), radial-gradient(70% 55% at 90% -10%, rgba(6,182,212,0.35), transparent 55%)",
          }}
        />
        <div className={`${SECTION} relative flex min-h-[42vh] flex-col justify-end py-10 sm:min-h-0 sm:py-20`}>
          <p className="packs-fade text-[10px] font-semibold tracking-[0.28em] text-cyan-200/90 uppercase sm:text-[11px]">
            Honic Nexis
          </p>
          <h1 className="packs-fade packs-fade-delay-1 mt-3 max-w-[14ch] text-[2.35rem] leading-[0.98] font-semibold tracking-tight text-white sm:max-w-2xl sm:text-5xl">
            Your desk, your pace.
          </h1>
          <p className="packs-fade packs-fade-delay-2 mt-3 max-w-md text-[13px] leading-relaxed text-white/75 sm:mt-4 sm:text-base">
            Unlock workspace, peer help, and title hides. Pay with mobile money — activates when verified.
          </p>

          <div className="packs-fade packs-fade-delay-3 mt-6 flex gap-2 sm:mt-8 sm:gap-3">
            <a
              href="#plans"
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 transition active:scale-[0.98] sm:flex-none sm:rounded-full sm:px-5 sm:py-2.5"
            >
              Choose a plan
            </a>
            <Link
              href="/portal/titles"
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-4 py-3.5 text-sm font-semibold text-white backdrop-blur transition active:scale-[0.98] sm:flex-none sm:rounded-full sm:px-5 sm:py-2.5"
            >
              Final year titles
            </Link>
          </div>
        </div>
      </section>

      {/* Sticky access strip — sits under the portal header on phone */}
      <div className="border-dash-border/60 bg-dash-canvas/90 sticky top-[3.6rem] z-20 border-b backdrop-blur-md sm:static sm:border-0 sm:bg-transparent sm:pt-0 sm:backdrop-blur-none">
        <div className={`${SECTION} flex items-center gap-3 py-2.5 sm:pt-6 sm:pb-0`}>
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${planActive ? "bg-emerald-400" : "bg-amber-300"}`}
            aria-hidden
          />
          <p className="text-dash-foreground min-w-0 truncate text-xs sm:text-sm">
            <span className="font-semibold">Your access</span>
            <span className="text-dash-muted-foreground mx-1.5">·</span>
            <span className="text-dash-muted-foreground">{planLabel}</span>
          </p>
        </div>
      </div>

      {/* Plans — snap carousel on phone, grid on desktop */}
      <section id="plans" className="scroll-mt-16 pt-6 sm:scroll-mt-24 sm:pt-14">
        <div className={SECTION}>
          <div className="max-w-2xl px-0.5">
            <p className={EYEBROW}>Plans</p>
            <h2 className="text-dash-foreground mt-1.5 text-xl font-semibold tracking-tight sm:mt-2 sm:text-3xl">
              Pick the length that fits
            </h2>
            <p className="text-dash-muted-foreground mt-1.5 text-[13px] leading-relaxed sm:mt-2 sm:text-sm">
              {PRICING_BOARD.trial.note} Paid plans include {FREE_TITLE_SLOTS} free hides and peer-help posting.
              Renewals stack — you never lose days.
            </p>
          </div>

          {/* Mobile: horizontal snap tickets (best value first) */}
          <div className="packs-snap -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden">
            <div className="w-[82vw] max-w-[320px] shrink-0 snap-center">
              <SubscriptionPlanCard
                planId="year"
                name="Full year"
                period="12 months"
                price={SUBSCRIPTION_YEAR_TSH}
                perMonth={yearPerMonth}
                badge="Best value"
                highlight
                points={yearPoints}
                signedIn={signedIn}
                phone={phone}
                active={planActive && deskPlan === "year"}
              />
            </div>
            <div className="w-[82vw] max-w-[320px] shrink-0 snap-center">
              <SubscriptionPlanCard
                planId="semester"
                name="Semester"
                period="6 months"
                price={SUBSCRIPTION_SEMESTER_TSH}
                perMonth={semesterPerMonth}
                points={semesterPoints}
                signedIn={signedIn}
                phone={phone}
                active={planActive && deskPlan === "semester"}
              />
            </div>
            <div className="w-[82vw] max-w-[320px] shrink-0 snap-center">
              <MonthlyPlanCard signedIn={signedIn} phone={phone} active={planActive && deskPlan === "monthly"} />
            </div>
            <div className="w-[82vw] max-w-[320px] shrink-0 snap-center">
              <FreePlanCard active={!planActive} />
            </div>
          </div>
          <p className="text-dash-muted-foreground mt-1 text-center text-[11px] sm:hidden">Swipe for more plans →</p>

          {/* Desktop / tablet grid */}
          <div className="mt-10 hidden items-stretch gap-5 sm:grid md:grid-cols-2 xl:grid-cols-4">
            <FreePlanCard active={!planActive} />
            <MonthlyPlanCard signedIn={signedIn} phone={phone} active={planActive && deskPlan === "monthly"} />
            <SubscriptionPlanCard
              planId="semester"
              name="Semester"
              period="6 months"
              price={SUBSCRIPTION_SEMESTER_TSH}
              perMonth={semesterPerMonth}
              points={semesterPoints}
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
              points={yearPoints}
              signedIn={signedIn}
              phone={phone}
              active={planActive && deskPlan === "year"}
            />
          </div>
        </div>
      </section>

      {/* Benefits — compact phone rows, not sparse card grid */}
      <section className="pt-10 sm:pt-16">
        <div className={SECTION}>
          <p className={EYEBROW}>What you get</p>
          <h2 className="text-dash-foreground mt-1.5 text-xl font-semibold tracking-tight sm:mt-2 sm:text-3xl">
            Everything a paid plan opens
          </h2>

          <div className="border-dash-border bg-dash-card mt-5 divide-dash-border/70 divide-y overflow-hidden rounded-2xl border sm:mt-8 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:rounded-3xl">
            <BenefitRow
              title="Peer help"
              body={PRICING_BOARD.jobs.note}
              action={
                <Link href="/portal/jobs" className="text-dash-accent text-sm font-semibold">
                  Open →
                </Link>
              }
            />
            <BenefitRow
              title="Title hides"
              body={`${formatTsh(EXTRA_TITLE_HIDE_FEE_TSH)} per hide outside the ${FREE_TITLE_SLOTS} included.`}
              action={
                <Link href="/portal/titles" className="text-dash-accent text-sm font-semibold">
                  Open →
                </Link>
              }
            />
            <BenefitRow
              title="Project documents"
              body={
                planActive
                  ? "Included with your active plan."
                  : `${formatTsh(PROJECT_DOCUMENTS_ACCESS_TSH)} to unlock, or free on any paid plan.`
              }
              action={
                signedIn && !planActive ? (
                  <DocumentsUnlockPanel phone={phone} compact />
                ) : !signedIn ? (
                  <Link href="/portal" className="text-dash-accent text-sm font-semibold">
                    Sign in →
                  </Link>
                ) : null
              }
            />
          </div>

          {/* Free vs paid — single split panel on phone */}
          <div className="border-dash-border mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border sm:mt-5 sm:gap-4 sm:border-0 sm:bg-transparent md:grid-cols-2">
            <ChecklistPanel title="Always free" items={PRICING_BOARD.freeAlways} compact />
            <ChecklistPanel title="Paid only" items={PRICING_BOARD.paidOnly} highlight compact />
          </div>
        </div>
      </section>

      {/* Title rules — phone timeline */}
      <section className="pt-10 sm:pt-16">
        <div className={SECTION}>
          <div className="border-dash-border bg-dash-card rounded-2xl border p-5 sm:rounded-3xl sm:p-10">
            <p className={EYEBROW}>How titles work</p>
            <h2 className="text-dash-foreground mt-1.5 text-xl font-semibold tracking-tight sm:mt-2 sm:text-3xl">
              Select free. Hide to protect.
            </h2>
            <p className="text-dash-muted-foreground mt-2 text-[13px] leading-relaxed sm:text-sm">
              Hiding is not buying the idea — it keeps a title from classmates at your institution, course, and level
              until defence.
            </p>
            <ol className="relative mt-6 space-y-0 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-6 sm:space-y-0 lg:grid-cols-4">
              {[
                { n: "1", t: "Select free", d: "Keeps a title in front. Classmates can still see it until hidden." },
                {
                  n: "2",
                  t: "Hide when ready",
                  d: `Free plan pays ${formatTsh(EXTRA_TITLE_HIDE_FEE_TSH)} per hide. Paid plans include ${FREE_TITLE_SLOTS}.`,
                },
                { n: "3", t: "Not a title shop", d: "Payment only activates classmate-hide protection on this portal." },
                { n: "4", t: "Defend clearly", d: "Hiding blocks others at your institution, course, and level." },
              ].map((item, i, arr) => (
                <li key={item.n} className="relative flex gap-3 pb-6 last:pb-0 sm:block sm:pl-12 sm:pb-0">
                  {i < arr.length - 1 ? (
                    <span
                      aria-hidden
                      className="bg-dash-border absolute top-8 bottom-0 left-[15px] w-px sm:hidden"
                    />
                  ) : null}
                  <span className="bg-dash-accent/15 text-dash-accent relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold sm:absolute sm:top-0 sm:left-0">
                    {item.n}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-dash-foreground text-sm font-semibold sm:text-base">{item.t}</h3>
                    <p className="text-dash-muted-foreground mt-1 text-[13px] leading-relaxed sm:text-sm">{item.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 sm:mt-8">
              <Link href="/portal/titles" className={`${SECONDARY} inline-flex w-full justify-center sm:w-auto`}>
                Open final year titles
              </Link>
            </div>
          </div>
        </div>
      </section>

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
      className={`relative flex h-full flex-col rounded-2xl border p-5 transition duration-300 sm:rounded-3xl sm:p-7 sm:hover:-translate-y-0.5 ${
        highlight
          ? "border-dash-accent/50 bg-dash-card shadow-[0_24px_50px_-30px_color-mix(in_oklab,var(--dash-accent)_55%,transparent)] ring-1 ring-dash-accent/25"
          : "border-dash-border bg-dash-card"
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="text-dash-muted-foreground min-w-0 truncate text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px]">
          {eyebrow}
        </p>
        {badge ? (
          <span className="bg-dash-accent shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
            {badge}
          </span>
        ) : active ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 uppercase dark:text-emerald-200">
            Active
          </span>
        ) : null}
      </div>
      <h3 className="text-dash-foreground mt-2 text-xl font-semibold tracking-tight sm:mt-3 sm:text-2xl">{name}</h3>
      <p className="text-dash-foreground mt-3 flex flex-wrap items-baseline gap-x-2 sm:mt-4">
        <span className="text-[1.65rem] font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-3xl">
          {price}
        </span>
        {priceNote ? <span className="text-dash-muted-foreground text-[11px] tabular-nums sm:text-xs">{priceNote}</span> : null}
      </p>
      {children}
      <div className="mt-auto pt-5 sm:pt-6">{footer}</div>
    </article>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="text-dash-muted-foreground mt-4 space-y-2 text-[13px] leading-relaxed sm:mt-6 sm:space-y-2.5 sm:text-sm">
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
      priceNote="2-week Desk trial on register"
      active={active}
      footer={
        <Link href="/portal/titles" className={`${SECONDARY} w-full`}>
          Browse final year titles
        </Link>
      }
    >
      <FeatureList
        items={[
          "2-week free Desk trial (monthly limits)",
          "Final year titles browse",
          "Select titles for free",
          "After trial: browse peer help; pay per hide",
        ]}
      />
    </PlanShell>
  );
}

function MonthlyPlanCard({ signedIn, phone, active }: { signedIn: boolean; phone: string; active?: boolean }) {
  const router = useRouter();
  const [months, setMonths] = useState(1);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [waitPaymentId, setWaitPaymentId] = useState<string | null>(null);
  const price = SUBSCRIPTION_MONTH_TSH * months;
  const monthOptions = Array.from({ length: MAX_MEMBERSHIP_MONTHS }, (_, i) => i + 1);

  function pay(fd: FormData) {
    setStatus(null);
    setWaitPaymentId(null);
    startTransition(async () => {
      const res = await portalPayForMembershipAction(
        "monthly",
        String(fd.get("network") ?? ""),
        String(fd.get("phone") ?? ""),
        months,
      );
      setStatus(res);
      if (res.ok && res.awaitingPayment && res.paymentId) {
        setWaitPaymentId(res.paymentId);
        return;
      }
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
          waitPaymentId={waitPaymentId}
          onClearWait={() => setWaitPaymentId(null)}
        />
      }
    >
      <div className="mt-3 sm:mt-4">
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
      <FeatureList items={["Full Nexis Desk tools", "Peer help post and offer", `${FREE_TITLE_SLOTS} free title hides`, `Storage up to ${MONTHLY_STORAGE}`]} />
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
  const [waitPaymentId, setWaitPaymentId] = useState<string | null>(null);

  function pay(fd: FormData) {
    setStatus(null);
    setWaitPaymentId(null);
    startTransition(async () => {
      const res = await portalPayForMembershipAction(planId, String(fd.get("network") ?? ""), String(fd.get("phone") ?? ""));
      setStatus(res);
      if (res.ok && res.awaitingPayment && res.paymentId) {
        setWaitPaymentId(res.paymentId);
        return;
      }
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
          waitPaymentId={waitPaymentId}
          onClearWait={() => setWaitPaymentId(null)}
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
  waitPaymentId,
  onClearWait,
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
  waitPaymentId: string | null;
  onClearWait: () => void;
}) {
  if (!open) {
    return (
      <>
        <button
          type="button"
          disabled={!signedIn}
          onClick={() => setOpen(true)}
          className={`${PRIMARY} w-full whitespace-nowrap py-3.5 sm:py-2.5 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {ctaIdle}
        </button>
        {!signedIn ? (
          <Link href="/portal" className="text-dash-accent mt-3 block text-center text-xs font-semibold">
            Sign in first →
          </Link>
        ) : (
          <p className="text-dash-muted-foreground mt-2.5 text-center text-[11px]">Activates after verified payment</p>
        )}
      </>
    );
  }

  if (waitPaymentId) {
    return (
      <MembershipPaymentWait
        paymentId={waitPaymentId}
        onDone={() => {
          onClearWait();
          setOpen(false);
        }}
        onRetry={() => onClearWait()}
      />
    );
  }

  return (
    <form
      className="border-dash-border grid gap-3 border-t pt-4 sm:pt-5"
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
        <input name="phone" required type="tel" className={INPUT} defaultValue={phone} placeholder="07XX XXX XXX" autoComplete="tel" inputMode="tel" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={`${SECONDARY} w-full`} onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className={`${PRIMARY} w-full`} disabled={pending}>
          {pending ? "Sending…" : active ? "Pay to renew" : "Pay now"}
        </button>
      </div>
      {status && !(status.ok && status.awaitingPayment) ? <StatusText status={status} /> : null}
      {status?.ok && status.awaitingPayment ? (
        <p className="text-dash-muted-foreground text-sm">{status.message}</p>
      ) : null}
    </form>
  );
}

function MembershipPaymentWait({
  paymentId,
  onDone,
  onRetry,
}: {
  paymentId: string;
  onDone: () => void;
  onRetry: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"waiting" | "paid" | "failed" | "expired">("waiting");
  const [message, setMessage] = useState("Approve the prompt on your phone…");
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    const started = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, 15 * 60 - Math.floor((Date.now() - started) / 1000));
      setSecondsLeft(left);
    }, 1000);

    async function poll() {
      if (stopped.current) return;
      const res = await portalCheckMembershipPaymentAction(paymentId);
      if (stopped.current) return;
      setMessage(res.message);
      if (res.state === "paid") {
        setPhase("paid");
        stopped.current = true;
        router.refresh();
        window.setTimeout(() => {
          onDone();
          router.refresh();
        }, 1200);
        return;
      }
      if (res.state === "failed" || res.state === "expired") {
        setPhase(res.state);
        stopped.current = true;
        return;
      }
    }

    void poll();
    const poller = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      stopped.current = true;
      window.clearInterval(tick);
      window.clearInterval(poller);
    };
  }, [paymentId, onDone, router]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="border-dash-border grid gap-3 border-t pt-4 sm:pt-5">
      <div className="flex items-start gap-3 rounded-2xl bg-dash-muted/40 px-4 py-4">
        {phase === "waiting" ? (
          <span
            className="border-dash-accent mt-0.5 inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-t-transparent"
            aria-hidden
          />
        ) : phase === "paid" ? (
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">✓</span>
        ) : (
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600">!</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-dash-foreground text-sm font-semibold">
            {phase === "waiting"
              ? "Waiting for mobile-money approval"
              : phase === "paid"
                ? "Payment successful"
                : phase === "expired"
                  ? "Payment timed out"
                  : "Payment failed"}
          </p>
          <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed">{message}</p>
          {phase === "waiting" ? (
            <p className="text-dash-muted-foreground mt-2 text-xs tabular-nums">Time left ~{mins}:{secs}</p>
          ) : null}
        </div>
      </div>
      {phase === "waiting" ? (
        <p className="text-dash-muted-foreground text-center text-[11px]">Keep this page open. Your plan updates automatically when payment confirms.</p>
      ) : null}
      {phase === "paid" ? (
        <p className="text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">Refreshing your plan…</p>
      ) : null}
      {(phase === "failed" || phase === "expired") && (
        <button type="button" className={`${PRIMARY} w-full`} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

function ChecklistPanel({
  title,
  items,
  highlight,
  compact,
}: {
  title: string;
  items: readonly string[];
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`${compact ? "rounded-none border-0 p-4 sm:rounded-3xl sm:border sm:p-8" : "rounded-3xl border p-6 sm:p-8"} ${
        highlight
          ? "border-dash-accent/40 bg-dash-card"
          : "border-dash-border bg-dash-muted/30 sm:bg-dash-muted/40"
      } ${compact && highlight ? "border-l border-dash-border sm:border" : ""} ${compact && !highlight ? "border-r border-dash-border sm:border" : ""}`}
    >
      <h2 className="text-dash-foreground text-sm font-semibold tracking-tight sm:text-lg">{title}</h2>
      <ul className="text-dash-muted-foreground mt-3 space-y-2.5 text-[12px] leading-snug sm:mt-5 sm:space-y-3 sm:text-sm sm:leading-relaxed">
        {items.map((line) => (
          <li key={line} className="flex gap-2 sm:gap-3">
            <CheckIcon className="text-dash-accent mt-0.5 shrink-0" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BenefitRow({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-dash-foreground text-sm font-semibold sm:text-base">{title}</h3>
        {action ? <div className="shrink-0 sm:hidden">{action}</div> : null}
      </div>
      <p className="text-dash-muted-foreground flex-1 text-[13px] leading-relaxed sm:text-sm">{body}</p>
      {action ? <div className="mt-1 hidden sm:block">{action}</div> : null}
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
