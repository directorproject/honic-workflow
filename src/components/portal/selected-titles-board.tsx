"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalPayForChangeAction, portalPayForHideAction, type PortalResult } from "@/app/portal/actions";
import { Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { PAYMENT_NETWORKS, TITLE_CHANGE_FEE_TSH } from "@/lib/portal/config";
import type { PortalTitle } from "@/lib/portal/data";
import {
  EXTRA_TITLE_HIDE_FEE_TSH,
  FREE_TITLE_SLOTS,
  MAX_TITLE_CHOICES,
  type TitleHideEntitlement,
} from "@/lib/portal/title-limits";

type PayMode = { kind: "change"; titleId: string } | { kind: "hide" } | null;

export function SelectedTitlesBoard({
  selected,
  phone,
  projectStarted,
  entitlement,
}: {
  selected: PortalTitle[];
  phone: string;
  changeCredits?: number;
  projectStarted: boolean;
  entitlement?: TitleHideEntitlement | null;
}) {
  const router = useRouter();
  const [pay, setPay] = useState<PayMode>(null);
  const [waiting, setWaiting] = useState(false);
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [, startTransition] = useTransition();

  const fee = TITLE_CHANGE_FEE_TSH.toLocaleString();
  const hideFee = EXTRA_TITLE_HIDE_FEE_TSH.toLocaleString();
  const canAddMore = selected.length < MAX_TITLE_CHOICES;
  const needsPayToAdd = Boolean(entitlement?.needsPayment);
  const hasPaidPlan = Boolean(entitlement?.hasPaidPlan);

  function runChange(titleId: string, fd: FormData) {
    setWaiting(true);
    setStatus(null);
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 800));
      const network = String(fd.get("network") ?? "");
      const tel = String(fd.get("phone") ?? "");
      const res = await portalPayForChangeAction(network, tel, titleId);
      setWaiting(false);
      setStatus(res);
      if (res.ok) {
        setPay(null);
        router.refresh();
      }
    });
  }

  function runHide(fd: FormData) {
    setWaiting(true);
    setStatus(null);
    startTransition(async () => {
      const network = String(fd.get("network") ?? "");
      const tel = String(fd.get("phone") ?? "");
      const res = await portalPayForHideAction(network, tel);
      setWaiting(false);
      setStatus(res);
      if (res.ok) {
        setPay(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="relative overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">Your shortlist</p>
          <h2 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight">Selected titles</h2>
          <p className="text-dash-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            Titles you are studying sit here with your partner. Open each one to read the brief, plan changes, and
            follow what you have already shortlisted or protected.
          </p>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
          <span className="text-dash-muted-foreground tabular-nums">
            {selected.length} shortlisted · {selected.filter((t) => t.hiddenFromPeers).length} hidden
            {entitlement?.hasPaidPlan ? ` · ${entitlement.freeRemaining} free left` : null}
            {entitlement && entitlement.hideCredits > 0 ? ` · ${entitlement.hideCredits} credit` : null}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-0 md:grid-cols-2 md:divide-x md:divide-dash-border">
        {selected.length === 0 ? (
          <article className="relative min-h-[14rem] px-0 py-6 md:col-span-2 md:px-6 md:pl-0">
            <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">No titles yet</p>
            <h3 className="text-dash-foreground mt-4 text-xl font-semibold tracking-tight">Open a final year title</h3>
            <p className="text-dash-muted-foreground mt-2 max-w-[28rem] text-sm leading-relaxed">
              {hasPaidPlan
                ? `Your paid plan includes ${FREE_TITLE_SLOTS} free hides.`
                : `On a free plan, pay TSh ${hideFee} to hide and make a title yours.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/portal/titles" className="text-dash-accent text-sm font-semibold underline-offset-4 hover:underline">
                Final year titles →
              </Link>
              {needsPayToAdd ? (
                <button
                  type="button"
                  className="text-dash-foreground text-sm font-semibold underline-offset-4 hover:underline"
                  onClick={() => {
                    setPay({ kind: "hide" });
                    setStatus(null);
                  }}
                >
                  Buy hide credit (TSh {hideFee})
                </button>
              ) : null}
            </div>
          </article>
        ) : (
          selected.map((title, index) => {
            const payingHere = pay?.kind === "change" && pay.titleId === title.id;
            return (
              <article
                key={title.id}
                className={`relative min-h-[14rem] px-0 py-6 md:px-6 ${index % 2 === 0 ? "md:pl-0" : ""} ${index >= 2 ? "border-dash-border border-t" : ""} ${index === 1 ? "border-dash-border border-t md:border-t-0" : ""}`}
              >
                <span
                  aria-hidden
                  className="text-dash-foreground/5 pointer-events-none absolute -top-2 right-0 select-none font-serif text-[7rem] leading-none tracking-tight md:right-4"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="relative z-[1]">
                  <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">
                    Slot {index + 1}
                    {title.hiddenFromPeers ? " · hidden from classmates" : " · shortlist only"}
                  </p>
                  <h3 className="text-dash-foreground mt-4 max-w-[28rem] text-xl font-semibold leading-snug tracking-tight">{title.title}</h3>
                  {title.summary ? (
                    <p className="text-dash-muted-foreground mt-2 max-w-[28rem] text-sm leading-relaxed">{title.summary}</p>
                  ) : null}
                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link
                      href={`/portal/titles/${encodeURIComponent(title.id)}`}
                      className="text-dash-accent text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                    {projectStarted ? (
                      <span className="text-dash-muted-foreground text-xs">Started. See Honic progress.</span>
                    ) : (
                      <button
                        type="button"
                        className="text-dash-foreground text-sm font-semibold underline-offset-4 hover:underline"
                        onClick={() => {
                          setPay({ kind: "change", titleId: title.id });
                          setStatus(null);
                        }}
                      >
                        Change (TSh {fee})
                      </button>
                    )}
                  </div>

                  {payingHere ? (
                    <div className="border-dash-border mt-6 max-w-sm border-t pt-4">
                      {waiting ? (
                        <p className="text-dash-muted-foreground text-sm">Check your phone and approve TSh {fee}…</p>
                      ) : (
                        <form
                          className="grid gap-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            runChange(pay!.kind === "change" ? pay.titleId : title.id, new FormData(e.currentTarget));
                          }}
                        >
                          <p className="text-dash-foreground text-sm font-semibold">Release this title (TSh {fee})</p>
                          <Field label="Pay with">
                            <select name="network" className={INPUT} defaultValue={PAYMENT_NETWORKS[0]}>
                              {PAYMENT_NETWORKS.map((n) => (
                                <option key={n}>{n}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Mobile money number">
                            <input name="phone" required className={INPUT} defaultValue={phone} />
                          </Field>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className={SECONDARY} onClick={() => setPay(null)}>
                              Cancel
                            </button>
                            <button type="submit" className={PRIMARY}>
                              Send request
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      {canAddMore && selected.length > 0 ? (
        <div className="border-dash-border mt-6 border-t pt-5">
          <p className="text-dash-foreground text-sm font-semibold">Hide another title</p>
          <p className="text-dash-muted-foreground mt-1 max-w-xl text-sm">
            {needsPayToAdd
              ? `Buy a hide credit for TSh ${hideFee}, then pick from final year titles.`
              : entitlement && entitlement.hideCredits > 0
                ? `You have ${entitlement.hideCredits} hide credit${entitlement.hideCredits === 1 ? "" : "s"}. Choose the next title.`
                : `You still have ${entitlement?.freeRemaining ?? 0} free hide${(entitlement?.freeRemaining ?? 0) === 1 ? "" : "s"} on your plan.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/portal/titles" className="text-dash-accent text-sm font-semibold underline-offset-4 hover:underline">
              Final year titles →
            </Link>
            {needsPayToAdd ? (
              <button
                type="button"
                className="text-dash-foreground text-sm font-semibold underline-offset-4 hover:underline"
                onClick={() => {
                  setPay({ kind: "hide" });
                  setStatus(null);
                }}
              >
                Buy hide credit (TSh {hideFee})
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {pay?.kind === "hide" ? (
        <div className="border-dash-border mt-6 max-w-sm border-t pt-4">
          {waiting ? (
            <p className="text-dash-muted-foreground text-sm">Check your phone and approve TSh {hideFee}…</p>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                runHide(new FormData(e.currentTarget));
              }}
            >
              <p className="text-dash-foreground text-sm font-semibold">Buy 1 hide credit (TSh {hideFee})</p>
              <Field label="Pay with">
                <select name="network" className={INPUT} defaultValue={PAYMENT_NETWORKS[0]}>
                  {PAYMENT_NETWORKS.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </Field>
              <Field label="Mobile money number">
                <input name="phone" required className={INPUT} defaultValue={phone} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY} onClick={() => setPay(null)}>
                  Cancel
                </button>
                <button type="submit" className={PRIMARY}>
                  Send request
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {status ? (
        <div className="mt-4">
          <StatusText status={status} />
        </div>
      ) : null}
    </section>
  );
}
