"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SearchSelectOption = { value: string; label: string; hint?: string };

/** Searchable select. Panel portals to document.body so it never overflows nested form cards. */
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
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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

  const panel =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
            <button
              type="button"
              aria-label="Close list"
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <div
              className="border-dash-border bg-dash-card relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:max-h-[min(32rem,80vh)] sm:rounded-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-2">
                <span className="bg-dash-border absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full sm:hidden" aria-hidden />
                <p className="text-dash-foreground mt-2 text-sm font-semibold sm:mt-0">Choose an option</p>
                <button
                  type="button"
                  className="text-dash-muted-foreground hover:text-dash-foreground mt-2 text-sm font-semibold sm:mt-0"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="border-dash-border shrink-0 border-b p-2.5 sm:p-2">
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
                      setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
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
                  className="border-dash-border bg-dash-muted/40 text-dash-foreground focus:ring-dash-accent/25 w-full min-w-0 rounded-lg border px-3 py-2.5 text-base outline-none focus:ring-2 sm:py-2 sm:text-sm"
                />
              </div>
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 [scrollbar-width:thin]"
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
                      className={`flex min-h-11 cursor-pointer items-start gap-2 px-3.5 py-2.5 text-sm sm:min-h-0 sm:items-center sm:px-3 sm:py-2 ${
                        i === active ? "bg-dash-accent/10" : ""
                      } ${isSelected ? "text-dash-accent font-semibold" : "text-dash-foreground"}`}
                    >
                      <span className="min-w-0 flex-1 break-words leading-snug">
                        {o.label}
                        {o.hint ? (
                          <span className="text-dash-muted-foreground ml-1.5 text-xs font-normal">{o.hint}</span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" aria-hidden>
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
              <div className="h-[env(safe-area-inset-bottom)] shrink-0 sm:hidden" aria-hidden />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative w-full min-w-0 max-w-full">
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
        className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 flex min-h-12 w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-base outline-none focus:ring-2 sm:min-h-0 sm:px-3 sm:py-2.5 sm:text-sm"
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-dash-muted-foreground"}`}>
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
      {panel}
    </div>
  );
}
