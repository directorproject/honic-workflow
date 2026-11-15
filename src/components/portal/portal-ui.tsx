import type { ReactNode } from "react";

import { toUserError } from "@/lib/portal/user-errors";

export const INPUT =
  "border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:ring-2 sm:text-sm";
export const PRIMARY =
  "bg-dash-accent inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-wait disabled:opacity-60 sm:min-h-0";
export const SECONDARY =
  "border-dash-border bg-dash-muted hover:bg-dash-border inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 sm:min-h-0";

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="border-dash-border bg-dash-card rounded-2xl border p-5 shadow-sm sm:p-6">
      <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="text-dash-muted-foreground mt-1 mb-4 text-sm">{subtitle}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

export function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={wide ? "sm:col-span-2" : undefined}>
      <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">{label}</span>
      {children}
    </label>
  );
}

export function StatusText({ status }: { status: { ok: boolean; message?: string } | null }) {
  if (!status?.message) return null;
  const message = status.ok ? status.message : toUserError(status.message);
  return (
    <p
      role="status"
      className={status.ok ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-red-600 dark:text-red-300"}
    >
      {message}
    </p>
  );
}
