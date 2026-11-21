"use client";

import { useState, useTransition, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";

import { portalAcceptTitleTermsAction, type PortalResult } from "@/app/portal/actions";
import { StatusText } from "@/components/portal/portal-ui";
import {
  POLICY_FULL,
  POLICY_POINTS,
  RULES_FULL,
  RULE_POINTS,
  type FullClause,
  type ShortPoint,
} from "@/lib/portal/title-terms";

/** Read-only policy + rules on one page (titles catalogue sidebar). */
export function TitleRules() {
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">Titles</p>
        <h2 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Policy and rules</h2>
        <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed sm:text-base">
          Short version first. Open the full text only if you want the detail — same idea as app terms you expand when
          needed.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <TermsCard
          step="01"
          title="Policy"
          subtitle="How this portal is used"
          points={POLICY_POINTS}
          full={POLICY_FULL}
          fullLabel="Read full policy"
        />
        <TermsCard
          step="02"
          title="Title rules"
          subtitle="If you take a title"
          points={RULE_POINTS}
          full={RULES_FULL}
          fullLabel="Read full title rules"
        />
      </div>
    </div>
  );
}

/** First-time accept flow: policy then rules, then return to where the student was headed. */
export function TitleTermsGate({
  step,
  nextHref = "/portal/titles",
}: {
  step: "policy" | "rules";
  /** Where to go after both policy and rules are accepted (default: literature). */
  nextHref?: string;
}) {
  const router = useRouter();
  const [policySaved, setPolicySaved] = useState(step === "rules");
  const [view, setView] = useState<"policy" | "rules">(step);
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [pending, startTransition] = useTransition();
  const policy = view === "policy";
  const safeNext =
    nextHref.startsWith("/portal") && !nextHref.startsWith("//") ? nextHref : "/portal/titles";

  function show(next: "policy" | "rules") {
    if (next === "rules" && !policySaved) return;
    setView(next);
    setAccepted(false);
    setStatus(null);
  }

  function acceptAndContinue() {
    const savingPolicy = policy;
    startTransition(async () => {
      const result = await portalAcceptTitleTermsAction(savingPolicy ? "policy" : "rules");
      if (!result.ok) {
        setStatus(result);
        return;
      }
      setAccepted(false);
      setStatus(null);
      if (savingPolicy) {
        setPolicySaved(true);
        setView("rules");
        router.refresh();
        return;
      }
      router.push(safeNext);
      router.refresh();
    });
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
          {policy ? "Step 1 of 2" : "Step 2 of 2"}
        </p>
        <h1 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {policy ? "Policy" : "Title rules"}
        </h1>
        <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">
          {policy
            ? "Read the short points, accept, then continue to the title rules."
            : "Read the short points and accept to continue. Titles stay closed until both are accepted."}
        </p>
        <div className="mt-4 flex gap-2">
          <StepPill active={policy} done={policySaved && !policy} label="Policy" onClick={() => show("policy")} />
          <StepPill
            active={!policy}
            done={false}
            label="Title rules"
            disabled={!policySaved}
            onClick={() => show("rules")}
          />
        </div>
      </header>

      <TermsCard
        step={policy ? "01" : "02"}
        title={policy ? "Policy" : "Title rules"}
        subtitle={policy ? "How this portal is used" : "If you take a title"}
        points={policy ? POLICY_POINTS : RULE_POINTS}
        full={policy ? POLICY_FULL : RULES_FULL}
        fullLabel={policy ? "Read full policy" : "Read full title rules"}
        hideHeader
      />

      <StatusText status={status} />

      {policy && policySaved ? (
        <button
          type="button"
          onClick={() => show("rules")}
          className="bg-dash-accent inline-flex rounded-xl px-5 py-3 text-sm font-semibold text-white"
        >
          Continue to the title rules
        </button>
      ) : (
        <div className="border-dash-border bg-dash-card space-y-4 rounded-2xl border p-4 sm:p-5">
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              className="border-dash-border text-dash-accent mt-1 h-4 w-4 rounded"
              checked={accepted}
              disabled={pending}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span className="text-dash-foreground">
              {policy
                ? "I have read this policy and I accept it."
                : "I accept the title rules. Selecting keeps a title in front; paying makes it mine and hides it from classmates — not a title shop. I will study and change any project I take."}
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            {policy ? null : (
              <button
                type="button"
                onClick={() => show("policy")}
                className="border-dash-border text-dash-foreground hover:bg-dash-muted rounded-xl border px-5 py-3 text-sm font-semibold"
              >
                Back to the policy
              </button>
            )}
            <button
              type="button"
              className="bg-dash-accent rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
              disabled={!accepted || pending}
              onClick={acceptAndContinue}
            >
              {pending ? "Saving…" : policy ? "Accept and continue" : "Accept and continue"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function StepPill({
  active,
  done,
  label,
  disabled,
  onClick,
}: {
  active: boolean;
  done: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-dash-accent text-white"
          : done
            ? "bg-dash-accent/15 text-dash-accent"
            : "bg-dash-muted text-dash-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function TermsCard({
  step,
  title,
  subtitle,
  points,
  full,
  fullLabel,
  hideHeader = false,
}: {
  step: string;
  title: string;
  subtitle: string;
  points: ShortPoint[];
  full: FullClause[];
  fullLabel: string;
  hideHeader?: boolean;
}) {
  return (
    <article className="border-dash-border bg-dash-card flex flex-col rounded-2xl border p-5 sm:p-6">
      {hideHeader ? null : (
        <div className="mb-5">
          <p className="text-dash-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase">{step}</p>
          <h3 className="text-dash-foreground mt-1 text-lg font-semibold tracking-tight">{title}</h3>
          <p className="text-dash-muted-foreground mt-0.5 text-sm">{subtitle}</p>
        </div>
      )}

      <ul className="flex-1 space-y-4">
        {points.map((point) => (
          <li key={point.headline} className="flex gap-3">
            <span className="bg-dash-accent mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
            <div className="min-w-0">
              <p className="text-dash-foreground text-sm font-semibold">{point.headline}</p>
              <p className="text-dash-muted-foreground mt-0.5 text-sm leading-relaxed">{point.line}</p>
            </div>
          </li>
        ))}
      </ul>

      <FullText label={fullLabel} clauses={full} />
    </article>
  );
}

function FullText({ label, clauses }: { label: string; clauses: FullClause[] }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="border-dash-border mt-6 border-t pt-4"
      open={open}
      onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open)}
    >
      <summary className="text-dash-foreground group flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="group-hover:text-dash-accent transition-colors">{label}</span>
        <span
          className={`border-dash-border text-dash-muted-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <ol className="mt-4 space-y-4">
        {clauses.map((clause, index) => (
          <li key={clause.title}>
            <p className="text-dash-foreground text-sm font-semibold">
              <span className="text-dash-muted-foreground mr-1.5 font-mono text-xs">
                {String(index + 1).padStart(2, "0")}
              </span>
              {clause.title}
            </p>
            <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed">{clause.body}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
