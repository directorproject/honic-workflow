import type { ReactNode } from "react";

export const INPUT =
  "border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2";
export const PRIMARY = "bg-dash-accent rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
export const SECONDARY =
  "border-dash-border bg-dash-muted hover:bg-dash-border rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50";

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
  return (
    <p
      role="status"
      className={status.ok ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-red-600 dark:text-red-300"}
    >
      {status.message}
    </p>
  );
}
