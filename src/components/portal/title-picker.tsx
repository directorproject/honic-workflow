"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalSelectTitleAction, type PortalResult } from "@/app/portal/actions";
import { Card, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { TITLE_CHANGE_FEE_TSH } from "@/lib/portal/config";
import type { PortalTitle } from "@/lib/portal/data";

export function TitlePicker({
  titles,
  courseCode,
  hasCredit,
}: {
  titles: PortalTitle[];
  courseCode: string;
  hasCredit: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<PortalTitle | null>(null);
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card
      title={`Titles for ${courseCode}`}
      subtitle={`${titles.length} available. You can hold one title at a time; titles taken by other students are hidden.`}
    >
      {hasCredit ? (
        <p className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
          Payment received. Choose your new title.
        </p>
      ) : null}
      <StatusText status={status} />
      <ul className="mt-2 space-y-3">
        {titles.map((t) => (
          <li key={t.id} className="border-dash-border rounded-xl border p-4">
            <p className="text-dash-foreground font-semibold leading-snug">{t.title}</p>
            {t.summary ? <p className="text-dash-muted-foreground mt-1 text-sm">{t.summary}</p> : null}
            {t.hardware || t.communication ? (
              <details className="mt-2 text-sm">
                <summary className="text-dash-accent cursor-pointer text-xs font-semibold">More details</summary>
                {t.hardware ? (
                  <p className="text-dash-foreground mt-2">
                    <span className="text-dash-muted-foreground text-xs font-semibold uppercase">Hardware: </span>
                    {t.hardware}
                  </p>
                ) : null}
                {t.communication ? (
                  <p className="text-dash-foreground mt-1">
                    <span className="text-dash-muted-foreground text-xs font-semibold uppercase">Communication: </span>
                    {t.communication}
                  </p>
                ) : null}
              </details>
            ) : null}
            <button type="button" onClick={() => setConfirm(t)} className={`${PRIMARY} mt-3 px-3 py-1.5 text-xs`}>
              Select this title
            </button>
          </li>
        ))}
        {titles.length === 0 ? (
          <li className="text-dash-muted-foreground py-6 text-center text-sm">
            No titles are open for your course right now. Please check again later.
          </li>
        ) : null}
      </ul>

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="bg-dash-card border-dash-border w-full max-w-md rounded-2xl border p-5 shadow-xl">
            <p className="text-dash-foreground font-semibold">Select this title?</p>
            <p className="text-dash-foreground mt-2 text-sm">{confirm.title}</p>
            <p className="text-dash-muted-foreground mt-3 text-sm">
              It will be hidden from other students. Changing later costs TSh {TITLE_CHANGE_FEE_TSH.toLocaleString()}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setConfirm(null)} className={SECONDARY}>
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                className={PRIMARY}
                onClick={() =>
                  startTransition(async () => {
                    const res = await portalSelectTitleAction(confirm.id);
                    setStatus(res.ok ? null : res);
                    setConfirm(null);
                    router.refresh();
                  })
                }
              >
                {pending ? "Selecting…" : "Yes, select it"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
