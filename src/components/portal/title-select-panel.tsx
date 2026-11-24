"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import {
  portalChooseTitleAction,
  portalOwnAndHideTitleAction,
  portalPayForHideAction,
  type PortalResult,
} from "@/app/portal/actions";
import { Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { PAYMENT_NETWORKS } from "@/lib/portal/config";
import { EXTRA_TITLE_HIDE_FEE_TSH, MAX_TITLE_CHOICES } from "@/lib/portal/title-limits";
import { parseTitleListFilters, titleDetailHrefWithNotice } from "@/lib/portal/title-list-filters";

export function TitleSelectAction({
  proposalId,
  canChoose,
  isMine,
  isHiddenFromPeers = false,
  selectedCount,
  readOnly,
  readOnlyReason = "staff",
  needsPayment = false,
  hasPaidPlan: _hasPaidPlan = false,
  freeRemaining = 0,
  hideCredits = 0,
  phone = "",
}: {
  proposalId: string;
  canChoose: boolean;
  isMine: boolean;
  isHiddenFromPeers?: boolean;
  selectedCount: number;
  readOnly: boolean;
  /** Guest browse vs staff catalogue — both lock actions. */
  readOnlyReason?: "staff" | "guest";
  needsPayment?: boolean;
  hasPaidPlan?: boolean;
  freeRemaining?: number;
  hideCredits?: number;
  phone?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listFilters = parseTitleListFilters(searchParams);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payStatus, setPayStatus] = useState<PortalResult | null>(null);
  const full = selectedCount >= MAX_TITLE_CHOICES && !isMine;
  const fee = EXTRA_TITLE_HIDE_FEE_TSH.toLocaleString();
  const canOwnFree = freeRemaining > 0 || hideCredits > 0;

  function openPay() {
    setPayOpen(true);
    setPayStatus(null);
    setError(null);
  }

  function ownAndHideFree() {
    setError(null);
    startTransition(async () => {
      const result = await portalOwnAndHideTitleAction(proposalId);
      if (!result.ok) {
        setError(result.message ?? "Could not update this title.");
        if (/pay|TSh|hide/i.test(result.message ?? "")) openPay();
        return;
      }
      router.refresh();
      router.push(titleDetailHrefWithNotice(proposalId, "owned", listFilters));
    });
  }

  function payToOwn(fd: FormData) {
    setPayStatus(null);
    startTransition(async () => {
      // Ensure it is on the shortlist before charging hide-for-this-title.
      if (!isMine) {
        const selected = await portalChooseTitleAction(proposalId);
        if (!selected.ok) {
          setPayStatus(selected);
          return;
        }
      }
      const res = await portalPayForHideAction(
        String(fd.get("network") ?? ""),
        String(fd.get("phone") ?? ""),
        proposalId,
      );
      setPayStatus(res);
      if (res.ok) {
        router.refresh();
        router.push(titleDetailHrefWithNotice(proposalId, "owned", listFilters));
      }
    });
  }

  if (readOnly) {
    if (readOnlyReason === "guest") {
      return (
        <div className="text-right">
          <p className="text-dash-foreground text-sm font-semibold">Preview only</p>
          <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">
            You can read this title. Sign in to shortlist it or hide it from classmates.
          </p>
          <Link href="/portal?auth=signin" className="text-dash-accent mt-2 inline-block text-xs font-semibold">
            Sign in to use →
          </Link>
        </div>
      );
    }
    return <p className="text-dash-muted-foreground text-right text-xs leading-relaxed">Staff · read only</p>;
  }

  if (isMine && isHiddenFromPeers) {
    return (
      <div className="text-right">
        <p className="text-dash-foreground text-sm font-semibold">Yours · hidden from others</p>
        <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">
          Classmates at your institution / course / level cannot take it. Conflict protection for defence, not a title shop.
        </p>
        <Link href="/portal/home?tab=projects" className="text-dash-accent mt-2 inline-block text-xs font-semibold">
          Selected titles
        </Link>
      </div>
    );
  }

  if (full) {
    return (
      <div className="text-right">
        <p className="text-dash-foreground text-sm font-semibold">Shortlist full</p>
        <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">Release or change a title first.</p>
      </div>
    );
  }

  if (!canChoose && !isMine) {
    return (
      <div className="max-w-[14rem] text-right">
        <p className="text-dash-muted-foreground text-xs leading-relaxed">
          Not available for your group. A classmate may already have made it theirs.
        </p>
      </div>
    );
  }

  const payForm = payOpen ? (
    <form
      className="grid gap-2 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        payToOwn(new FormData(e.currentTarget));
      }}
    >
      <p className="text-dash-foreground text-sm font-semibold">
        Pay TSh {fee} to make this title yours and hide it from others
      </p>
      <p className="text-dash-muted-foreground text-xs leading-relaxed">
        After payment it is on your list and hidden from classmates. Not selling the title, only protecting your defence
        choice.
      </p>
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
      <button type="submit" disabled={pending} className={`${PRIMARY} w-full disabled:opacity-60`}>
        {pending ? "Sending…" : `Pay TSh ${fee}`}
      </button>
      <button type="button" className={SECONDARY} onClick={() => setPayOpen(false)}>
        Cancel
      </button>
      {payStatus ? <StatusText status={payStatus} /> : null}
    </form>
  ) : null;

  // Already shortlisted but not hidden yet.
  if (isMine) {
    return (
      <div className="w-full space-y-3 lg:text-right">
        {canOwnFree ? (
          <button type="button" disabled={pending} onClick={ownAndHideFree} className={`${PRIMARY} w-full disabled:opacity-60`}>
            {pending ? "Saving…" : freeRemaining > 0 ? "Make yours & hide (free on plan)" : "Make yours & hide (use credit)"}
          </button>
        ) : (
          <button type="button" className={`${PRIMARY} w-full`} onClick={openPay}>
            Pay TSh {fee} to make yours and hide from others
          </button>
        )}
        {payForm}
        <p className="text-dash-foreground text-sm font-semibold">On your shortlist</p>
        <p className="text-dash-muted-foreground text-xs leading-relaxed">
          Still visible to classmates. Pay or use a paid plan to hide and make it yours.
        </p>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Link href="/portal/home?tab=projects" className="text-dash-accent inline-block text-xs font-semibold">
          Selected titles
        </Link>
      </div>
    );
  }

  // Not selected yet.
  return (
    <div className="w-full space-y-3 lg:text-right">
      {canOwnFree ? (
        <button type="button" disabled={pending} onClick={ownAndHideFree} className={`${PRIMARY} w-full disabled:opacity-60`}>
          {pending
            ? "Saving…"
            : freeRemaining > 0
              ? "Make yours & hide from others (free)"
              : "Make yours & hide from others (credit)"}
        </button>
      ) : (
        <button type="button" className={`${PRIMARY} w-full`} onClick={openPay}>
          Pay TSh {fee} to make yours and hide from others
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await portalChooseTitleAction(proposalId);
            if (!result.ok) {
              setError(result.message ?? "Could not select this project.");
              return;
            }
            router.refresh();
            router.push(titleDetailHrefWithNotice(proposalId, "selected", listFilters));
          });
        }}
        className="border-dash-border text-dash-foreground inline-flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Select only (keep in front)"}
      </button>
      <p className="text-dash-muted-foreground text-xs leading-relaxed">
        <strong className="text-dash-foreground font-semibold">Pay</strong> makes it yours and hides it from classmates.{" "}
        <strong className="text-dash-foreground font-semibold">Select only</strong> keeps it in front but others can still
        take it. Not a title shop. Conflict protection for defence.
      </p>
      {payForm}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
