"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalPayForChangeAction, type PortalResult } from "@/app/portal/actions";
import { Card, Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { PAYMENT_NETWORKS, TITLE_CHANGE_FEE_TSH } from "@/lib/portal/config";
import type { PortalTitle } from "@/lib/portal/data";

export function MyTitleCard({
  title,
  phone,
  projectStarted,
}: {
  title: PortalTitle;
  phone: string;
  projectStarted: boolean;
}) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [, startTransition] = useTransition();
  const fee = TITLE_CHANGE_FEE_TSH.toLocaleString();

  return (
    <Card title="Your project title" subtitle="This title is yours. Other students can no longer see it.">
      <div className="border-dash-accent/40 bg-dash-accent/5 rounded-xl border p-4">
        <p className="text-dash-foreground text-lg font-semibold leading-snug">{title.title}</p>
        {title.summary ? <p className="text-dash-muted-foreground mt-1 text-sm">{title.summary}</p> : null}
        {title.hardware ? (
          <p className="text-dash-foreground mt-2 text-sm">
            <span className="text-dash-muted-foreground text-xs font-semibold uppercase">Hardware: </span>
            {title.hardware}
          </p>
        ) : null}
        {title.communication ? (
          <p className="text-dash-foreground mt-1 text-sm">
            <span className="text-dash-muted-foreground text-xs font-semibold uppercase">Communication: </span>
            {title.communication}
          </p>
        ) : null}
      </div>

      {projectStarted ? (
        <p className="text-dash-muted-foreground mt-4 text-sm">
          Honic has started your project. Open the <span className="font-semibold">My project</span> tab to follow it.
        </p>
      ) : (
        <div className="border-dash-border mt-5 border-t pt-4">
          {!paying ? (
            <>
              <p className="text-dash-muted-foreground text-sm">
                Want a different title? Changing costs <span className="text-dash-foreground font-semibold">TSh {fee}</span>.
                Your current title goes back to the list for others.
              </p>
              <button type="button" onClick={() => (setPaying(true), setStatus(null))} className={`${SECONDARY} mt-3`}>
                Pay to change title
              </button>
            </>
          ) : waiting ? (
            <div className="py-4 text-center">
              <p className="text-dash-foreground font-semibold">Check your phone</p>
              <p className="text-dash-muted-foreground mt-1 text-sm">Approve the TSh {fee} payment request…</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setWaiting(true);
                setStatus(null);
                startTransition(async () => {
                  await new Promise((r) => setTimeout(r, 2000));
                  const res = await portalPayForChangeAction(String(fd.get("network") ?? ""), String(fd.get("phone") ?? ""));
                  setWaiting(false);
                  setStatus(res);
                  if (res.ok) {
                    setPaying(false);
                    router.refresh();
                  }
                });
              }}
              className="grid gap-3"
            >
              <p className="text-dash-foreground text-sm font-semibold">Pay TSh {fee} to change your title</p>
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
              <div className="flex gap-2">
                <button type="button" onClick={() => setPaying(false)} className={SECONDARY}>
                  Cancel
                </button>
                <button type="submit" className={PRIMARY}>
                  Send payment request
                </button>
              </div>
            </form>
          )}
          <div className="mt-3">
            <StatusText status={status} />
          </div>
        </div>
      )}
    </Card>
  );
}
