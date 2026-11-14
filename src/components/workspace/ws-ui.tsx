"use client";

import { useEffect, type ReactNode } from "react";

import type { RunStatus } from "@/components/workspace/ws-context";

export const INPUT =
  "border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";
export const BTN =
  "bg-dash-accent inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60";
export const BTN_SOFT =
  "border-dash-border bg-dash-card hover:bg-dash-muted text-dash-foreground inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60";
export const BTN_GHOST =
  "text-dash-muted-foreground hover:text-dash-foreground hover:bg-dash-muted inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold disabled:cursor-wait disabled:opacity-60";
export const BTN_DANGER =
  "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:cursor-wait disabled:opacity-60 dark:text-red-300";

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-dash-border bg-dash-card rounded-2xl border p-4 shadow-sm sm:p-5 ${className}`}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-dash-foreground text-base font-semibold tracking-tight">{title}</h2> : null}
            {subtitle ? <p className="text-dash-muted-foreground mt-0.5 text-sm">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Label({ text, children, wide }: { text: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">{text}</span>
      {children}
    </label>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export function Status({ status }: { status: RunStatus }) {
  if (!status?.message) return null;
  return (
    <p role="status" className={`text-sm break-words ${status.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
      {status.message}
    </p>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-dash-border rounded-xl border border-dashed px-4 py-8 text-center">
      <p className="text-dash-foreground text-sm font-semibold">{title}</p>
      {children ? <div className="text-dash-muted-foreground mx-auto mt-1 max-w-md text-sm">{children}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, planned, className = "" }: { value: number; planned?: number; className?: string }) {
  return (
    <div className={`bg-dash-muted relative h-2.5 overflow-hidden rounded-full ${className}`}>
      <div className="bg-dash-accent h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      {planned !== undefined ? (
        <div
          className="absolute top-0 h-full w-0.5 bg-amber-500"
          style={{ left: `${Math.min(100, Math.max(0, planned))}%` }}
          title={`Planned by today: ${planned}%`}
        />
      ) : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border px-4 py-3 shadow-sm">
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone || "text-dash-foreground"}`}>{value}</p>
      {hint ? <p className="text-dash-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`border-dash-border bg-dash-card relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border p-5 shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-5xl" : "sm:max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-dash-foreground text-base font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className={BTN_GHOST} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Countdown({ date, label, today }: { date: string | null; label: string; today: string }) {
  if (!date) return null;
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return (
    <div className="text-center">
      <p className={`text-3xl font-bold tabular-nums ${days < 0 ? "text-dash-muted-foreground" : days <= 7 ? "text-amber-600 dark:text-amber-300" : "text-dash-accent"}`}>
        {days < 0 ? "Done" : days}
      </p>
      <p className="text-dash-muted-foreground text-xs">{days < 0 ? label : days === 1 ? `day to ${label}` : `days to ${label}`}</p>
    </div>
  );
}
