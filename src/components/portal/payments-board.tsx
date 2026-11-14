"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalSavePayoutAccountAction, type PortalResult } from "@/app/portal/actions";
import { Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { PAYMENT_NETWORKS } from "@/lib/portal/config";
import type { PortalPaymentRow } from "@/lib/portal/payments-ledger";
import type { PayoutAccount } from "@/lib/portal/payout-accounts";
import { formatTsh } from "@/lib/workspace/constants";
import { formatDate, formatDateTime } from "@/lib/workspace/dates";
import type { Invoice } from "@/lib/workspace/types";

export function PaymentsBoard({
  payments,
  invoices = [],
  registeredName,
  payoutEligible,
  payoutAccount,
  canPayInvoices = false,
}: {
  payments: PortalPaymentRow[];
  invoices?: Invoice[];
  registeredName: string;
  payoutEligible: boolean;
  payoutAccount: PayoutAccount | null;
  canPayInvoices?: boolean;
}) {
  const paidSum = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingSum = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const invoicePaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount_tsh, 0);
  const invoiceDue = invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.amount_tsh, 0);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">Honic Nexis</p>
        <h2 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight">Payments & invoices</h2>
        <p className="text-dash-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Your portal payments and project invoices, loaded from the server for your account only. Amounts and references
          cannot be edited here.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Portal payments paid" value={formatTsh(paidSum)} />
        <Stat label="Portal pending" value={formatTsh(pendingSum)} />
        <Stat label="Invoices paid" value={formatTsh(invoicePaid)} />
        <Stat label="Invoices to pay" value={formatTsh(invoiceDue)} />
      </div>

      <section className="border-dash-border bg-dash-card rounded-2xl border px-4 py-5 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-dash-foreground text-lg font-semibold tracking-tight">Your payments</h3>
            <p className="text-dash-muted-foreground mt-1 text-sm">
              Nexis Desk plans, title hides, and related portal charges.
            </p>
          </div>
          <Link href="/portal/packs" className="text-dash-accent text-sm font-semibold">
            Plans & access →
          </Link>
        </div>
        {payments.length ? (
          <ul className="divide-dash-border mt-4 divide-y">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-dash-foreground text-sm font-semibold">{p.purposeLabel}</p>
                  <p className="text-dash-muted-foreground mt-0.5 text-xs">
                    {formatDate(p.createdAt)}
                    {p.paidAt ? ` · paid ${formatDateTime(p.paidAt)}` : ""}
                    {p.status === "pending" && p.expiresAt ? ` · expires ${formatDateTime(p.expiresAt)}` : ""}
                    {p.status === "expired" && p.expiresAt ? ` · expired ${formatDateTime(p.expiresAt)}` : ""}
                    {p.network ? ` · ${p.network}` : ""}
                    {p.phone ? ` · ${maskPhone(p.phone)}` : ""}
                    {` · ref ${p.reference}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-dash-foreground text-sm font-semibold tabular-nums">{formatTsh(p.amount)}</p>
                  <StatusPill status={p.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-dash-muted-foreground mt-4 text-sm">No portal payments yet.</p>
        )}
      </section>

      <section className="border-dash-border bg-dash-card rounded-2xl border px-4 py-5 sm:px-5">
        <h3 className="text-dash-foreground text-lg font-semibold tracking-tight">Project invoices</h3>
        <p className="text-dash-muted-foreground mt-1 text-sm">
          Quotes and invoices from Honic for workspace project work.
        </p>
        {invoices.length ? (
          <ul className="divide-dash-border mt-4 divide-y">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-dash-foreground text-sm font-semibold">{inv.description}</p>
                  <p className="text-dash-muted-foreground mt-0.5 text-xs">
                    {formatDate(inv.created_at)}
                    {inv.due_date ? ` · due ${formatDate(inv.due_date)}` : ""}
                    {inv.status === "paid" && inv.paid_at
                      ? ` · paid ${formatDateTime(inv.paid_at)}${inv.network ? ` via ${inv.network}` : ""}${inv.reference ? ` · ref ${inv.reference}` : ""}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-dash-foreground text-sm font-semibold tabular-nums">{formatTsh(inv.amount_tsh)}</p>
                  <StatusPill status={inv.status} />
                  {canPayInvoices && inv.status === "unpaid" ? (
                    <p className="text-dash-muted-foreground mt-1 text-[11px]">Use Pay on the invoice row in workspace.</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-dash-muted-foreground mt-4 text-sm">No project invoices yet.</p>
        )}
      </section>

      <PayoutAccountPanel
        registeredName={registeredName}
        eligible={payoutEligible}
        account={payoutAccount}
      />
    </div>
  );
}

function PayoutAccountPanel({
  registeredName,
  eligible,
  account,
}: {
  registeredName: string;
  eligible: boolean;
  account: PayoutAccount | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  function save(fd: FormData) {
    setStatus(null);
    startTransition(async () => {
      const res = await portalSavePayoutAccountAction(
        String(fd.get("network") ?? ""),
        String(fd.get("phone") ?? ""),
        String(fd.get("accountName") ?? ""),
      );
      setStatus(res);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="border-dash-border bg-dash-card rounded-2xl border px-4 py-5 sm:px-5">
      <h3 className="text-dash-foreground text-lg font-semibold tracking-tight">Payout account</h3>
      <p className="text-dash-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
        For students with a confirmed title ownership claim. The account holder name must match your registered portal
        name. Numbers are sealed against tampering. To change a saved account, contact Help desk.
      </p>

      {!eligible ? (
        <div className="border-dash-border mt-4 rounded-xl border border-dashed px-4 py-3">
          <p className="text-dash-foreground text-sm font-semibold">Not available yet</p>
          <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed">
            Add a payout account only after admin confirms your title claim. If your claim is confirmed and you still
            cannot add one, contact Help desk.
          </p>
          <Link href="/portal/home?tab=messages" className="text-dash-accent mt-3 inline-block text-sm font-semibold">
            Contact Help desk →
          </Link>
        </div>
      ) : null}

      {account ? (
        <div className="border-dash-border mt-4 rounded-xl border px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-dash-foreground text-sm font-semibold">{account.accountName}</p>
              <p className="text-dash-muted-foreground mt-1 text-xs">
                {account.network} · {maskPhone(account.phone)} · {account.status}
                {account.sealOk ? " · integrity lock on" : " · integrity failed"}
              </p>
              {!account.sealOk ? (
                <p className="mt-2 text-sm text-red-600 dark:text-red-300">
                  This record failed the integrity check. Contact Help desk. Do not try to edit it yourself.
                </p>
              ) : null}
              {account.status === "locked" ? (
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                  Locked after a change attempt. Contact Help desk to update the number or name.
                </p>
              ) : null}
            </div>
            <Link href="/portal/home?tab=messages" className="text-dash-accent text-sm font-semibold">
              Help desk →
            </Link>
          </div>
        </div>
      ) : null}

      {eligible && (!account || account.status === "active") && account?.sealOk !== false ? (
        <div className="mt-4">
          {!open ? (
            <button
              type="button"
              className={PRIMARY}
              onClick={() => {
                setOpen(true);
                setStatus(null);
              }}
              disabled={Boolean(account)}
            >
              {account ? "Account already saved" : "Add payout account"}
            </button>
          ) : (
            <form
              className="border-dash-border grid max-w-lg gap-3 border-t pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                save(new FormData(e.currentTarget));
              }}
            >
              <p className="text-dash-muted-foreground text-xs leading-relaxed">
                Type your name exactly as registered. Mismatched names are rejected. After save, edits are blocked.
              </p>
              <Field label="Account holder name (must match registered name)">
                <input
                  name="accountName"
                  required
                  className={INPUT}
                  defaultValue={registeredName}
                  placeholder={registeredName}
                />
              </Field>
              <Field label="Network">
                <select name="network" className={INPUT} defaultValue={PAYMENT_NETWORKS[0]}>
                  {PAYMENT_NETWORKS.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </Field>
              <Field label="Mobile money number">
                <input name="phone" required className={INPUT} placeholder="07XX XXX XXX" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY} onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </button>
                <button type="submit" className={PRIMARY} disabled={pending}>
                  {pending ? "Saving…" : "Save payout account"}
                </button>
              </div>
              {status ? <StatusText status={status} /> : null}
            </form>
          )}
        </div>
      ) : null}

      {eligible && !account ? (
        <p className="text-dash-muted-foreground mt-3 text-xs">
          If the SIM name differs from your portal name, do not force a mismatch. Contact Help desk instead.
        </p>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3">
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">{label}</p>
      <p className="text-dash-foreground mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
      : status === "pending" || status === "unpaid"
        ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
        : status === "expired"
          ? "bg-orange-500/15 text-orange-900 dark:text-orange-200"
          : status === "quote"
            ? "bg-sky-500/15 text-sky-900 dark:text-sky-200"
            : "bg-dash-muted text-dash-muted-foreground";
  return (
    <span className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${tone}`}>
      {status}
    </span>
  );
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "••••";
  return `${digits.slice(0, 3)}••••${digits.slice(-3)}`;
}
