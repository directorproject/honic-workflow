"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchSelectOption = { value: string; label: string; hint?: string };

/** Themed dropdown with search; on phones opens as a bottom sheet so the list stays usable. */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Choose…",
  searchPlaceholder = "Type to search…",
  emptyText = "No match",
}: {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function openList() {
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setQuery("");
    setActive(idx);
    setOpen(true);
  }

  function choose(option: SearchSelectOption) {
    onChange(option.value);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openList();
          }
        }}
        className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-base outline-none focus:ring-2 sm:min-h-0 sm:px-3 sm:py-2.5 sm:text-sm"
      >
        <span className={selected ? "truncate" : "text-dash-muted-foreground truncate"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          className={`text-dash-muted-foreground h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"
          />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close list"
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="border-dash-border bg-dash-card fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-2xl border shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:z-40 sm:mt-1.5 sm:max-h-none sm:w-full sm:rounded-xl sm:shadow-xl">
            <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 sm:hidden">
              <span className="bg-dash-border absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full" aria-hidden />
              <p className="text-dash-foreground mt-2 text-sm font-semibold">Choose an option</p>
              <button
                type="button"
                className="text-dash-muted-foreground hover:text-dash-foreground mt-2 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="border-dash-border border-b p-2.5 sm:p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => Math.min(i + 1, filtered.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const option = filtered[active];
                    if (option) choose(option);
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder={searchPlaceholder}
                className="border-dash-border bg-dash-muted/40 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2 sm:py-2 sm:text-sm"
              />
            </div>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className="max-h-[min(55vh,22rem)] overflow-y-auto overscroll-contain py-1 [scrollbar-width:thin] sm:max-h-64"
            >
              {filtered.map((o, i) => {
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(o);
                    }}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 px-3.5 py-2.5 text-sm sm:min-h-0 sm:px-3 sm:py-2 ${
                      i === active ? "bg-dash-accent/10" : ""
                    } ${isSelected ? "text-dash-accent font-semibold" : "text-dash-foreground"}`}
                  >
                    <span className="min-w-0 flex-1 leading-snug">
                      {o.label}
                      {o.hint ? (
                        <span className="text-dash-muted-foreground ml-1.5 text-xs font-normal">{o.hint}</span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
                        <path
                          fill="currentColor"
                          d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z"
                        />
                      </svg>
                    ) : null}
                  </li>
                );
              })}
              {filtered.length === 0 ? (
                <li className="text-dash-muted-foreground px-3 py-3 text-sm">{emptyText}</li>
              ) : null}
            </ul>
            <div className="h-[env(safe-area-inset-bottom)] sm:hidden" aria-hidden />
          </div>
        </>
      ) : null}
    </div>
  );
}
