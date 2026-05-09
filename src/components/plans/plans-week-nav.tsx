"use client";

import Link from "next/link";

import { buildPlansUrl } from "@/lib/plans-url";

export function PlansWeekNav({
  weekOffset,
  clientFilter,
}: {
  weekOffset: number;
  clientFilter: string;
}) {
  const client = clientFilter.trim() || undefined;

  return (
    <nav
      className="border-dash-border bg-dash-card flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-sm"
      aria-label="Week filter"
    >
      <Link
        href={buildPlansUrl({ client, week: weekOffset - 1 })}
        className="border-dash-border bg-dash-muted/40 hover:bg-dash-muted text-dash-foreground rounded-xl border px-3 py-2 text-xs font-semibold transition-colors"
      >
        ← Previous week
      </Link>
      <Link
        href={buildPlansUrl({ client, week: 0 })}
        className={
          weekOffset === 0
            ? "bg-dash-accent/20 text-dash-foreground ring-dash-accent/35 rounded-xl px-3 py-2 text-xs font-semibold ring-2"
            : "border-dash-border bg-dash-muted/40 hover:bg-dash-muted text-dash-foreground rounded-xl border px-3 py-2 text-xs font-semibold transition-colors"
        }
      >
        This week
      </Link>
      <Link
        href={buildPlansUrl({ client, week: weekOffset + 1 })}
        className="border-dash-border bg-dash-muted/40 hover:bg-dash-muted text-dash-foreground rounded-xl border px-3 py-2 text-xs font-semibold transition-colors"
      >
        Next week →
      </Link>
      {weekOffset !== 0 ? (
        <span className="text-dash-muted-foreground ml-1 text-[11px] font-medium">
          Offset <span className="text-dash-foreground tabular-nums">{weekOffset > 0 ? "+" : ""}{weekOffset}</span>
        </span>
      ) : null}
    </nav>
  );
}
