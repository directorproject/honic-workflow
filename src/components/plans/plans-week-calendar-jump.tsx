"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

import { weekOffsetForContainingIsoDate } from "@/lib/next-week-milestones-data";
import { buildPlansUrl } from "@/lib/plans-url";

export function PlansWeekCalendarJump({
  clientFilter,
  weekMondayIso,
}: {
  clientFilter: string;
  /** Monday (YYYY-MM-DD) of the week currently shown — seeds the date picker. */
  weekMondayIso: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const client = clientFilter.trim() || undefined;

  function go() {
    const raw = inputRef.current?.value?.trim() ?? "";
    if (!raw) return;
    const offset = weekOffsetForContainingIsoDate(raw);
    router.push(buildPlansUrl({ client, week: offset }));
  }

  return (
    <div className="border-dash-border bg-dash-card flex min-w-[min(100%,18rem)] flex-1 flex-col gap-2 rounded-2xl border px-3 py-2.5 shadow-sm sm:flex-row sm:items-end sm:gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor="plans-week-jump" className="text-dash-muted-foreground mb-1 block text-[11px] font-semibold uppercase tracking-wide">
          Jump to week
        </label>
        <input
          ref={inputRef}
          id="plans-week-jump"
          type="date"
          defaultValue={weekMondayIso}
          className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
        />
        <p className="text-dash-muted-foreground mt-1 text-[10px] leading-snug">
          Pick any day in the week you want. The board shows Mon–Sat columns; Sunday deadlines appear on Saturday.
        </p>
      </div>
      <button
        type="button"
        onClick={go}
        className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
      >
        Go
      </button>
    </div>
  );
}
