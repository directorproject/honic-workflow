"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalEscrowResolveAction, portalMarkPeerPayoutAction } from "@/app/portal/job-actions";
import type { StaffEscrowQueueItem, StaffPayoutQueueItem } from "@/lib/portal/job-escrow-shared";
import { toUserError } from "@/lib/portal/user-errors";

const CARD = "rounded-2xl border border-dash-border bg-dash-card p-4 shadow-sm";
const INPUT =
  "w-full rounded-xl border border-dash-border bg-dash-canvas px-3 py-2 text-sm text-dash-foreground outline-none focus:border-dash-accent";
const BTN =
  "inline-flex items-center justify-center rounded-xl bg-dash-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-60";
const SOFT =
  "inline-flex items-center justify-center rounded-xl border border-dash-border bg-dash-muted/40 px-3 py-2 text-xs font-semibold text-dash-foreground disabled:opacity-60";

function formatTsh(n: number) {
  return `TSh ${Math.round(n).toLocaleString()}`;
}

export function PeerHelpStaffQueues({
  disputes,
  payouts,
}: {
  disputes: StaffEscrowQueueItem[];
  payouts: StaffPayoutQueueItem[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={CARD}>
        <h2 className="text-dash-foreground text-sm font-semibold tracking-wide uppercase">Open disputes</h2>
        <p className="text-dash-muted-foreground mt-1 text-xs">Open the job for chat + preview evidence, then resolve.</p>
        <ul className="mt-4 space-y-4">
          {disputes.length === 0 ? (
            <li className="text-dash-muted-foreground text-sm">No open disputes.</li>
          ) : (
            disputes.map((d) => <DisputeRow key={d.escrowPublicId} item={d} />)
          )}
        </ul>
      </section>

      <section className={CARD}>
        <h2 className="text-dash-foreground text-sm font-semibold tracking-wide uppercase">Helper payouts</h2>
        <p className="text-dash-muted-foreground mt-1 text-xs">
          Mark paid after you send mobile money from the queued escrow release.
        </p>
        <ul className="mt-4 space-y-4">
          {payouts.length === 0 ? (
            <li className="text-dash-muted-foreground text-sm">No queued payouts.</li>
          ) : (
            payouts.map((p) => <PayoutRow key={p.payoutPublicId} item={p} />)
          )}
        </ul>
      </section>
    </div>
  );
}

function DisputeRow({ item }: { item: StaffEscrowQueueItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <li className="border-dash-border rounded-xl border bg-dash-canvas/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-dash-foreground text-sm font-semibold">{item.jobTitle}</p>
          <p className="text-dash-muted-foreground text-xs tabular-nums">
            {formatTsh(item.amountTsh)} · ESC {item.escrowPublicId.slice(0, 8)}
          </p>
        </div>
        <Link href={item.href} className="text-dash-accent text-xs font-semibold">
          Open job →
        </Link>
      </div>
      {item.disputeReason ? (
        <p className="text-dash-muted-foreground mt-2 text-xs leading-relaxed">{item.disputeReason}</p>
      ) : null}
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const resolution = String(fd.get("resolution")) === "refund" ? "refund" : "release";
          const note = String(fd.get("note") ?? "");
          setMsg(null);
          startTransition(async () => {
            const res = await portalEscrowResolveAction(item.escrowPublicId, resolution, note);
            setMsg(res.ok ? res.message || "Saved." : toUserError(res.message ?? ""));
            if (res.ok) router.refresh();
          });
        }}
      >
        <select name="resolution" className={INPUT} defaultValue="release">
          <option value="release">Release to helper</option>
          <option value="refund">Refund poster</option>
        </select>
        <textarea name="note" required minLength={5} rows={2} className={INPUT} placeholder="Resolution note" />
        <button type="submit" className={BTN} disabled={pending}>
          {pending ? "Saving…" : "Apply resolution"}
        </button>
      </form>
      {msg ? <p className="mt-2 text-xs text-dash-muted-foreground">{msg}</p> : null}
    </li>
  );
}

function PayoutRow({ item }: { item: StaffPayoutQueueItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function mark(status: "processing" | "paid" | "failed") {
    setMsg(null);
    startTransition(async () => {
      const note =
        status === "failed" ? window.prompt("Failure reason (optional)") || undefined : undefined;
      const res = await portalMarkPeerPayoutAction(item.payoutPublicId, status, note);
      setMsg(res.ok ? res.message || "Saved." : toUserError(res.message ?? ""));
      if (res.ok) router.refresh();
    });
  }

  return (
    <li className="border-dash-border rounded-xl border bg-dash-canvas/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-dash-foreground text-sm font-semibold tabular-nums">{formatTsh(item.amountTsh)}</p>
          <p className="text-dash-muted-foreground text-xs">
            {item.status} · {item.network || "—"} · {item.phone || "no phone"}
            {item.accountName ? ` · ${item.accountName}` : ""}
          </p>
        </div>
        <Link href={item.href} className="text-dash-accent text-xs font-semibold">
          Open job →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={SOFT} disabled={pending || item.status === "processing"} onClick={() => mark("processing")}>
          Processing
        </button>
        <button type="button" className={BTN} disabled={pending} onClick={() => mark("paid")}>
          Mark paid
        </button>
        <button type="button" className={SOFT} disabled={pending} onClick={() => mark("failed")}>
          Failed
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-dash-muted-foreground">{msg}</p> : null}
    </li>
  );
}
