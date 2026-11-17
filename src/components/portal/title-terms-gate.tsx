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

export function TitleRules() {
  return (
    <div>
      <TermsBlock kicker="01  Policy" title="How this portal is used" points={POLICY_POINTS} full={POLICY_FULL} fullLabel="Full policy" startOpen />
      <TermsBlock kicker="02  Title rules" title="If you take a title" points={RULE_POINTS} full={RULES_FULL} fullLabel="Full title rules" />
    </div>
  );
}

export function TitleTermsGate({ step }: { step: "policy" | "rules" }) {
  const router = useRouter();
  const [policySaved, setPolicySaved] = useState(step === "rules");
  const [view, setView] = useState<"policy" | "rules">(step);
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [pending, startTransition] = useTransition();
  const policy = view === "policy";
  const points = policy ? POLICY_POINTS : RULE_POINTS;
  const full = policy ? POLICY_FULL : RULES_FULL;

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
      router.push("/portal/titles");
      router.refresh();
    });
  }

  return (
    <section className="border-dash-foreground grid border sm:grid-cols-[10.5rem_minmax(0,1fr)]">
      <aside className="bg-dash-sidebar text-white px-4 py-5 sm:px-5 sm:py-6">
        <p className="text-dash-sidebar-muted font-mono text-xs tracking-[0.18em]">{policy ? "01 / 02" : "02 / 02"}</p>
        <h1 className="mt-4 text-2xl leading-none font-semibold sm:mt-8 sm:text-3xl">{policy ? "Policy" : "Rules"}</h1>
        <div className="mt-6 space-y-2">
          <button type="button" onClick={() => show("policy")} className={`block text-left text-sm ${policy ? "font-semibold text-white" : "text-dash-sidebar-muted"}`}>
            01 Policy
          </button>
          <button
            type="button"
            onClick={() => show("rules")}
            disabled={!policySaved}
            className={`block text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${policy ? "text-dash-sidebar-muted" : "font-semibold text-white"}`}
          >
            02 Title rules
          </button>
        </div>
        <p className="text-dash-sidebar-muted mt-4 text-sm leading-relaxed">
          {policySaved ? "You can come back to the policy. The titles stay closed until you accept the rules." : "Accept the policy before the title rules."}
        </p>
      </aside>
      <div className="bg-dash-card min-w-0 px-4 py-5 sm:px-8 sm:py-8">
        <p className="text-dash-foreground text-base font-semibold sm:text-lg">
          {policy
            ? "Read the four lines, then the full policy below. Accept it to open the title rules."
            : "Read the four lines, then the full title rules below. Accept them to open the titles."}
        </p>
        <PointLedger points={points} />
        <FullText key={view} label={policy ? "Full policy" : "Full title rules"} clauses={full} startOpen />
        <StatusText status={status} />
        {policy && policySaved ? (
          <button type="button" onClick={() => show("rules")} className="bg-dash-foreground text-dash-card mt-6 px-5 py-3 text-sm font-semibold">
            Continue to the title rules
          </button>
        ) : (
          <>
            <label className="mt-6 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={accepted} disabled={pending} onChange={(event) => setAccepted(event.target.checked)} />
              <span>
                {policy
                  ? "I accept this policy."
                  : "I accept the title rules. Selecting keeps a title in front; paying makes it mine and hides it from classmates, not a title shop. I will study and change any project I take."}
              </span>
            </label>
            <div className="mt-5 flex flex-wrap gap-3">
              {policy ? null : (
                <button type="button" onClick={() => show("policy")} className="border-dash-foreground text-dash-foreground border px-5 py-3 text-sm font-semibold">
                  Back to the policy
                </button>
              )}
              <button
                type="button"
                className="bg-dash-foreground text-dash-card px-5 py-3 text-sm font-semibold disabled:opacity-40"
                disabled={!accepted || pending}
                onClick={acceptAndContinue}
              >
                {pending ? "Saving…" : policy ? "Continue to the title rules" : "Open the titles"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function TermsBlock({
  kicker,
  title,
  points,
  full,
  fullLabel,
  startOpen = false,
}: {
  kicker: string;
  title: string;
  points: ShortPoint[];
  full: FullClause[];
  fullLabel: string;
  startOpen?: boolean;
}) {
  return (
    <section className="border-dash-foreground border-t py-6 first:border-t-0 first:pt-0">
      <p className="text-dash-muted-foreground font-mono text-xs tracking-[0.16em] uppercase">{kicker}</p>
      <h2 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      <PointLedger points={points} />
      <FullText label={fullLabel} clauses={full} startOpen={startOpen} />
    </section>
  );
}

function PointLedger({ points }: { points: ShortPoint[] }) {
  return (
    <ol className="border-dash-foreground mt-5 border-t">
      {points.map((point, index) => (
        <li key={point.headline} className="border-dash-foreground/15 grid grid-cols-[2.75rem_1fr] gap-x-4 border-b py-4 sm:grid-cols-[3rem_11rem_1fr] sm:items-baseline">
          <span className="text-dash-accent font-mono text-sm">{String(index + 1).padStart(2, "0")}</span>
          <p className="text-dash-foreground font-semibold">{point.headline}</p>
          <p className="text-dash-muted-foreground col-start-2 text-sm leading-relaxed sm:col-start-3">{point.line}</p>
        </li>
      ))}
    </ol>
  );
}

function FullText({ label, clauses, startOpen = false }: { label: string; clauses: FullClause[]; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <details className="mt-4" open={open} onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open)}>
      <summary className="text-dash-foreground w-fit cursor-pointer border-b border-current text-sm font-semibold">{label}</summary>
      <ol className="border-dash-foreground/15 mt-4 border-l pl-4">
        {clauses.map((clause, index) => (
          <li key={clause.title} className="py-3">
            <p className="text-dash-foreground text-sm font-semibold">
              <span className="text-dash-muted-foreground font-mono">{String(index + 1).padStart(2, "0")} </span>
              {clause.title}
            </p>
            <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed">{clause.body}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
