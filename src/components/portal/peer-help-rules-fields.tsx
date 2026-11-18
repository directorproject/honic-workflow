"use client";

import {
  PEER_HELP_ALLOWED_HINT,
  PEER_HELP_FORBIDDEN_HINT,
  PEER_HELP_RULES_SUMMARY,
} from "@/lib/portal/jobs-peer-help";

export function PeerHelpRulesSummary({ compact = false }: { compact?: boolean }) {
  return (
    <div className="border-dash-border bg-dash-muted/20 rounded-md border px-3 py-3 sm:px-4">
      <p className="text-dash-foreground text-xs font-semibold uppercase tracking-wide">Peer-help rules</p>
      {!compact ? (
        <ul className="text-dash-muted-foreground mt-2 space-y-2 text-xs leading-relaxed">
          {PEER_HELP_RULES_SUMMARY.map((rule) => (
            <li key={rule.headline}>
              <span className="text-dash-foreground font-semibold">{rule.headline}. </span>
              {rule.line}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-dash-muted-foreground mt-2 text-xs leading-relaxed">
        <span className="text-emerald-800 dark:text-emerald-200">{PEER_HELP_ALLOWED_HINT}</span>
        {" · "}
        <span className="text-rose-800 dark:text-rose-200">{PEER_HELP_FORBIDDEN_HINT}</span>
      </p>
    </div>
  );
}

export function PeerHelpRulesCheckbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm leading-relaxed">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        I agree to the{" "}
        <strong className="text-dash-foreground font-semibold">peer-help rules</strong>: peer assistance only, no paid
        full reports or exam work, and Honic may remove posts that break this.
      </span>
    </label>
  );
}