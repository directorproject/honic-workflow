"use client";

import { useEffect, useState, useTransition, type ComponentType } from "react";
import { useRouter } from "next/navigation";

import { portalAcceptPeerHelpRulesAction } from "@/app/portal/job-actions";
import {
  IconBook,
  IconCheck,
  IconLock,
  IconShield,
  IconUsers,
  IconWallet,
} from "@/components/zimamoto/icons";
import { PEER_HELP_RULES_SUMMARY } from "@/lib/portal/jobs-peer-help";

const ICONS: ComponentType<{ size?: number; className?: string }>[] = [
  IconBook,
  IconShield,
  IconCheck,
  IconLock,
  IconUsers,
  IconWallet,
  IconWallet,
  IconShield,
];

/**
 * Shown on top of peer help until a student accepts the current rules. It cannot be closed
 * without accepting. The server also refuses posts, offers, and messages until accepted.
 */
export function PeerHelpPolicyGate() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Lock page scroll while the policy is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function accept() {
    setMessage(null);
    start(async () => {
      const res = await portalAcceptPeerHelpRulesAction();
      if (!res.ok) {
        setMessage(res.message ?? "Could not save. Try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="peer-help-policy-title" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="bg-dash-card flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:rounded-3xl">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-6 text-white">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-white/80 uppercase">Before you start</p>
          <h2 id="peer-help-policy-title" className="mt-1 text-2xl font-bold tracking-tight">
            Peer-help rules
          </h2>
          <p className="mt-1 text-sm text-white/85">Please read and accept these rules to post, offer help, or chat.</p>
        </div>

        <ul className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {PEER_HELP_RULES_SUMMARY.map((p, i) => {
            const Icon = ICONS[i % ICONS.length] ?? IconCheck;
            return (
              <li key={p.headline} className="flex gap-3">
                <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="text-dash-foreground block text-sm font-semibold">{p.headline}</span>
                  <span className="text-dash-muted-foreground block text-sm leading-relaxed">{p.line}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="border-dash-border space-y-3 border-t px-6 py-5">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={pending}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span className="text-dash-foreground leading-relaxed">
              I have read these rules and I agree to follow them.
            </span>
          </label>
          <button
            type="button"
            onClick={accept}
            disabled={!agreed || pending}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : "Accept and continue"}
          </button>
          {message ? <p className="text-xs text-red-600">{message}</p> : null}
          <p className="text-dash-muted-foreground text-center text-[11px]">You can only continue after you accept.</p>
        </div>
      </div>
    </div>
  );
}
