"use client";

import { useState } from "react";

import { createInvoiceAction, payInvoiceAction, setInvoiceStatusAction } from "@/app/portal/workspace-actions";
import { PaymentsBoard } from "@/components/portal/payments-board";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN, BTN_GHOST, Empty, INPUT, Label, Modal, Panel, Status } from "@/components/workspace/ws-ui";
import { PAYMENT_NETWORKS } from "@/lib/portal/config";
import type { PortalPaymentRow } from "@/lib/portal/payments-ledger";
import type { PayoutAccount } from "@/lib/portal/payout-accounts";
import { formatTsh, INVOICE_STATUSES, tone } from "@/lib/workspace/constants";
import { formatDate, formatDateTime } from "@/lib/workspace/dates";
import type { Invoice } from "@/lib/workspace/types";

export function PaymentsSection({
  invoices,
  payments = [],
  registeredName = "",
  payoutEligible = false,
  payoutAccount = null,
}: {
  invoices: Invoice[];
  payments?: PortalPaymentRow[];
  registeredName?: string;
  payoutEligible?: boolean;
  payoutAccount?: PayoutAccount | null;
}) {
  const { workspaceId, viewer } = useWs();
  const create = useRun();
  const [paying, setPaying] = useState<Invoice | null>(null);

  return (
    <>
      <PaymentsBoard
        payments={payments}
        invoices={invoices}
        registeredName={registeredName}
        payoutEligible={payoutEligible}
        payoutAccount={payoutAccount}
        canPayInvoices={viewer.kind === "student"}
      />

      {viewer.kind === "staff" ? (
        <Panel title="New quote or invoice" subtitle="For Honic services on this project: design help, fabrication, components, lab time.">
          <form
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_10rem_9rem_10rem_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              create.run(
                () =>
                  createInvoiceAction(workspaceId, {
                    description: String(fd.get("description")),
                    amount: Number(fd.get("amount")),
                    status: String(fd.get("status")),
                    dueDate: String(fd.get("due")),
                  }),
                { onOk: () => (e.target as HTMLFormElement).reset() },
              );
            }}
          >
            <Label text="Service">
              <input name="description" required maxLength={240} placeholder="e.g. PCB design and fabrication" className={INPUT} />
            </Label>
            <Label text="Amount (TSh)">
              <input name="amount" type="number" min={100} step={100} required className={INPUT} />
            </Label>
            <Label text="Kind">
              <select name="status" className={INPUT}>
                <option value="unpaid">Invoice</option>
                <option value="quote">Quote</option>
              </select>
            </Label>
            <Label text="Due">
              <input name="due" type="date" className={INPUT} />
            </Label>
            <div className="flex items-end">
              <button type="submit" disabled={create.pending} className={BTN}>
                Add
              </button>
            </div>
          </form>
          <div className="mt-2">
            <Status status={create.status} />
          </div>
        </Panel>
      ) : null}

      {viewer.kind === "student" ? (
        <Panel title="Pay an unpaid invoice" subtitle="Open Pay on a row below. Snippe confirms before the invoice marks paid.">
          {invoices.filter((i) => i.status === "unpaid").length ? (
            <ul className="divide-dash-border divide-y">
              {invoices
                .filter((i) => i.status === "unpaid")
                .map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} onPay={() => setPaying(inv)} />
                ))}
            </ul>
          ) : (
            <Empty title="No unpaid invoices">When Honic sends an invoice for project work, you can pay it here.</Empty>
          )}
        </Panel>
      ) : null}

      {viewer.kind === "staff" ? (
        <Panel title="Manage invoices">
          {invoices.length ? (
            <ul className="divide-dash-border divide-y">
              {invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} onPay={() => setPaying(inv)} />
              ))}
            </ul>
          ) : (
            <Empty title="Nothing here">Quotes and invoices will appear here.</Empty>
          )}
        </Panel>
      ) : null}

      <PayDialog invoice={paying} onClose={() => setPaying(null)} />
    </>
  );
}

function InvoiceRow({ invoice: inv, onPay }: { invoice: Invoice; onPay: () => void }) {
  const { workspaceId, viewer } = useWs();
  const { run, status } = useRun();
  const st = tone(INVOICE_STATUSES, inv.status);
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-dash-foreground text-sm font-semibold">{inv.description}</p>
        <p className="text-dash-muted-foreground text-xs">
          {formatDate(inv.created_at)}
          {inv.due_date ? ` · due ${formatDate(inv.due_date)}` : ""}
          {inv.status === "paid" ? ` · paid ${formatDateTime(inv.paid_at)} via ${inv.network} · ref ${inv.reference}` : ""}
        </p>
        <Status status={status} />
      </div>
      <p className="text-dash-foreground text-sm font-bold tabular-nums">{formatTsh(inv.amount_tsh)}</p>
      <Badge className={st.tone}>{st.label}</Badge>
      {viewer.kind === "student" && inv.status === "unpaid" ? (
        <button type="button" className={BTN} onClick={onPay}>
          Pay
        </button>
      ) : null}
      {viewer.kind === "staff" && inv.status !== "paid" ? (
        <select
          aria-label="Change status"
          value={inv.status}
          onChange={(e) => run(() => setInvoiceStatusAction(workspaceId, inv.id, e.target.value))}
          className={`${INPUT} w-auto py-1 text-xs`}
        >
          <option value="quote">Quote</option>
          <option value="unpaid">Invoice (unpaid)</option>
          <option value="cancelled">Cancelled</option>
        </select>
      ) : null}
    </li>
  );
}

function PayDialog({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { workspaceId } = useWs();
  const { run, pending, status } = useRun();
  const [network, setNetwork] = useState<string>(PAYMENT_NETWORKS[0]);
  const [phone, setPhone] = useState("");
  if (!invoice) return null;
  return (
    <Modal open onClose={onClose} title={`Pay ${formatTsh(invoice.amount_tsh)}`}>
      <p className="text-dash-muted-foreground mb-3 text-sm">{invoice.description}</p>
      <p className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-100">
        You will get a mobile-money prompt on this number (Snippe). Enter your PIN to confirm. The invoice updates only after
        verified payment.
      </p>
      <div className="grid gap-3">
        <Label text="Network">
          <select value={network} onChange={(e) => setNetwork(e.target.value)} className={INPUT}>
            {PAYMENT_NETWORKS.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Label>
        <Label text="Phone number">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" className={INPUT} />
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className={BTN}
            onClick={() =>
              run(() => payInvoiceAction(workspaceId, invoice.id, { network, phone }), {
                onOk: () => setTimeout(onClose, 1500),
              })
            }
          >
            {pending ? "Paying…" : "Pay now"}
          </button>
          <button type="button" className={BTN_GHOST} onClick={onClose}>
            Cancel
          </button>
        </div>
        <Status status={status} />
      </div>
    </Modal>
  );
}
