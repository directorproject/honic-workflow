"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalPayForDocumentsAction, type PortalResult } from "@/app/portal/actions";
import { Field, INPUT, PRIMARY, StatusText } from "@/components/portal/portal-ui";
import { formatTsh } from "@/lib/portal/document-packs";
import { PAYMENT_NETWORKS, PROJECT_DOCUMENTS_ACCESS_TSH } from "@/lib/portal/config";

export function DocumentsUnlockPanel({
  phone = "",
  compact = false,
}: {
  phone?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  function pay(fd: FormData) {
    setStatus(null);
    startTransition(async () => {
      const res = await portalPayForDocumentsAction(String(fd.get("network") ?? ""), String(fd.get("phone") ?? ""));
      setStatus(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className={compact ? "mt-3 space-y-2" : "border-dash-border bg-dash-card mt-3 space-y-3 rounded-lg border px-4 py-3"}>
      <p className="text-dash-muted-foreground text-sm leading-relaxed">
        Source files stay locked until you unlock them. View in the browser after payment — not listed as a free download.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/portal/packs" className="text-dash-accent text-sm font-semibold">
          View Nexis Desk plans →
        </Link>
        {!open ? (
          <button type="button" className="text-dash-foreground text-sm font-semibold underline" onClick={() => setOpen(true)}>
            Unlock documents · {formatTsh(PROJECT_DOCUMENTS_ACCESS_TSH)}
          </button>
        ) : null}
      </div>
      {open ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            pay(new FormData(e.currentTarget));
          }}
        >
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
          <button type="submit" disabled={pending} className={PRIMARY}>
            {pending ? "Sending…" : `Pay ${formatTsh(PROJECT_DOCUMENTS_ACCESS_TSH)}`}
          </button>
          {status ? <StatusText status={status} /> : null}
        </form>
      ) : null}
    </div>
  );
}
