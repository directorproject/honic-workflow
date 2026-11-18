"use client";

import { useEffect, useState, useTransition } from "react";

import {
  portalZimamotoCreateInviteAction,
  portalZimamotoListInvitesAction,
  portalZimamotoRevokeInviteAction,
} from "@/app/portal/zimamoto-actions";
import type { ZimamotoInvite } from "@/lib/portal/zimamoto-access";
import { IconCheck, IconLink, IconLock, IconUserPlus } from "@/components/zimamoto/icons";

/** Admin-only panel for a private group: send invitations, see who has been invited, cancel them. */
export function InvitePanel({ groupId, groupName, onClose }: { groupId: string; groupName: string; onClose: () => void }) {
  const [invites, setInvites] = useState<ZimamotoInvite[] | null>(null);
  const [maxUses, setMaxUses] = useState(25);
  const [days, setDays] = useState(14);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reload() {
    return portalZimamotoListInvitesAction(groupId).then((res) => setInvites(res.invites));
  }

  useEffect(() => {
    let alive = true;
    portalZimamotoListInvitesAction(groupId).then((res) => {
      if (alive) setInvites(res.invites);
    });
    return () => {
      alive = false;
    };
  }, [groupId]);

  function create() {
    setMessage(null);
    start(async () => {
      const res = await portalZimamotoCreateInviteAction({ groupId, maxUses, days });
      setMessage(res.message ?? null);
      await reload();
    });
  }

  function revoke(id: string) {
    start(async () => {
      const res = await portalZimamotoRevokeInviteAction(id);
      setMessage(res.message ?? null);
      await reload();
    });
  }

  function copy(code: string) {
    void navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1600);
  }

  const active = (invites ?? []).filter((i) => !i.revoked && !i.expired && i.uses < i.maxUses);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Invite people">
      <div className="bg-dash-card border-dash-border flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl border sm:rounded-3xl">
        <div className="border-dash-border flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-dash-foreground font-bold">Invite to {groupName}</p>
            <p className="text-dash-muted-foreground flex items-center gap-1 text-xs">
              <IconLock size={12} /> Private group. Only you, the admin, can send invitations.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-dash-muted-foreground hover:text-dash-foreground text-sm font-semibold">
            Done
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <section className="border-dash-border rounded-2xl border p-4">
            <p className="text-dash-foreground text-sm font-semibold">New invitation</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-dash-muted-foreground text-xs">
                People allowed
                <select value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className="border-dash-border bg-dash-canvas text-dash-foreground mt-1 w-full rounded-xl border px-3 py-2 text-sm">
                  {[1, 5, 10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-dash-muted-foreground text-xs">
                Valid for
                <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border-dash-border bg-dash-canvas text-dash-foreground mt-1 w-full rounded-xl border px-3 py-2 text-sm">
                  {[1, 7, 14, 30, 90].map((n) => (
                    <option key={n} value={n}>
                      {n} day{n === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={create}
              disabled={pending}
              className="bg-dash-accent mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <IconUserPlus size={16} /> {pending ? "Creating…" : "Create invitation code"}
            </button>
            {message ? <p className="text-dash-muted-foreground mt-2 text-xs">{message}</p> : null}
          </section>

          <section className="space-y-2">
            <p className="text-dash-foreground text-sm font-semibold">Active invitations ({active.length})</p>
            {invites === null ? <p className="text-dash-muted-foreground text-xs">Loading…</p> : null}
            {invites && active.length === 0 ? <p className="text-dash-muted-foreground text-xs">No active invitations. Create one above.</p> : null}
            {active.map((inv) => (
              <div key={inv.id} className="border-dash-border flex items-center gap-3 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-dash-foreground truncate font-mono text-xs">{inv.code}</p>
                  <p className="text-dash-muted-foreground text-[11px]">
                    Used {inv.uses} of {inv.maxUses} · expires {new Date(inv.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <button type="button" onClick={() => copy(inv.code)} className="text-dash-accent flex items-center gap-1 text-xs font-semibold">
                  {copied === inv.code ? <IconCheck size={14} /> : <IconLink size={14} />}
                  {copied === inv.code ? "Copied" : "Copy"}
                </button>
                <button type="button" onClick={() => revoke(inv.id)} disabled={pending} className="text-xs font-semibold text-red-600 disabled:opacity-50">
                  Cancel
                </button>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
