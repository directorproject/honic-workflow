"use client";

import { useState } from "react";

import { createInvoiceAction, payInvoiceAction, setInvoiceStatusAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN, BTN_GHOST, Empty, INPUT, Label, Modal, Panel, Stat, Status } from "@/components/workspace/ws-ui";
import { PAYMENT_NETWORKS } from "@/lib/portal/config";
import { formatTsh, INVOICE_STATUSES, tone } from "@/lib/workspace/constants";
import { formatDate, formatDateTime } from "@/lib/workspace/dates";
import type { Invoice } from "@/lib/workspace/types";

export function PaymentsSection({ invoices }: { invoices: Invoice[] }) {
  const { workspaceId, viewer } = useWs();
  const create = useRun();
  const [paying, setPaying] = useState<Invoice | null>(null);
  const unpaid = invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.amount_tsh, 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount_tsh, 0);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="To pay" value={formatTsh(unpaid)} tone={unpaid ? "text-amber-600 dark:text-amber-300" : ""} />
        <Stat label="Paid to Honic" value={formatTsh(paid)} />
      </div>

      {viewer.kind === "staff" ? (
        <Panel title="New quote or invoice" subtitle="For Honic services on this project: design help, fabrication, components, lab time.">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_10rem_9rem_10rem_auto]"
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

      <Panel title="Quotes and invoices" subtitle="Payments are a test for now: no money is taken.">
        {invoices.length ? (
          <ul className="divide-dash-border divide-y">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} onPay={() => setPaying(inv)} />
            ))}
          </ul>
        ) : (
          <Empty title="Nothing here">Quotes and invoices from Honic for work on your project will appear here.</Empty>
        )}
      </Panel>
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
      <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
        Test payment: no money is taken. Real mobile money will be connected later.
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
          <button type="button" disabled={pending} className={BTN} onClick={() => run(() => payInvoiceAction(workspaceId, invoice.id, { network, phone }), { onOk: () => setTimeout(onClose, 1500) })}>
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
