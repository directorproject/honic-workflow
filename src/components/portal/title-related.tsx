"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ReviewItem } from "@/lib/portal/title-choices";
import { titleDetailHref } from "@/lib/portal/title-list-filters";
import { portalTitleSectionScrollMt } from "@/lib/portal/fixed-header";
import type { TitleListFilters } from "@/lib/portal/title-list-filters";

type Tab = "department" | "institution" | "year";

export function TitleRelated({
  item,
  related,
  listFilters,
  className = "",
}: {
  item: ReviewItem;
  related: { department: ReviewItem[]; institution: ReviewItem[]; year: ReviewItem[] };
  listFilters?: TitleListFilters;
  className?: string;
}) {
  const filters = listFilters;
  const tabs = useMemo(() => {
    const list: { id: Tab; label: string; items: ReviewItem[]; href: string | null; empty: string }[] = [
      {
        id: "department",
        label: "Same department",
        items: related.department,
        href: item.courseCode ? `/portal/titles?department=${encodeURIComponent(item.courseCode)}` : null,
        empty: "No other title in this department.",
      },
      {
        id: "institution",
        label: "Same institution",
        items: related.institution,
        href: item.institution ? `/portal/titles?institution=${encodeURIComponent(item.institution)}` : null,
        empty: "No other title at this institution.",
      },
      {
        id: "year",
        label: "Same year",
        items: related.year,
        href: `/portal/titles?year=${encodeURIComponent(item.yearLabel)}`,
        empty: "No other title in this year.",
      },
    ];
    return list;
  }, [item, related]);

  const firstWithItems = tabs.find((tab) => tab.items.length)?.id ?? "department";
  const [active, setActive] = useState<Tab>(firstWithItems);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <section id="more" className={`${portalTitleSectionScrollMt} ${className ?? "mt-10"}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-dash-foreground text-sm font-semibold">Related titles</h2>
          <p className="text-dash-muted-foreground mt-1 text-xs">Continue your literature from nearby titles.</p>
        </div>
        {current.href ? (
          <Link href={current.href} className="text-dash-accent text-xs font-semibold">
            Open full list
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                on ? "border-dash-foreground bg-dash-foreground text-dash-card" : "border-dash-border text-dash-muted-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums opacity-70">{tab.items.length}</span>
            </button>
          );
        })}
      </div>

      {current.items.length ? (
        <ul className="border-dash-border mt-4 divide-y border-t">
          {current.items.map((entry) => (
            <li key={entry.id} className="py-3">
              <Link
                href={filters ? titleDetailHref(entry.id, filters) : `/portal/titles/${encodeURIComponent(entry.id)}`}
                className="text-dash-foreground block text-sm leading-snug font-medium hover:underline"
              >
                {entry.title}
              </Link>
              <p className="text-dash-muted-foreground mt-1 text-[11px] uppercase tracking-wide">
                {entry.yearLabel}
                {entry.courseCode ? ` · ${entry.courseCode}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-dash-muted-foreground mt-4 text-sm">{current.empty}</p>
      )}
    </section>
  );
}
