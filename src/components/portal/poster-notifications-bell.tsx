"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type PosterNotice = {
  publicId: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

type Props = {
  unread: number;
  items: PosterNotice[];
  onRefresh: () => Promise<void> | void;
  onChange: (next: { unread: number; items: PosterNotice[] }) => void;
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/** Header bell for posters: live count + dropdown with View → that job post. */
export function PosterNotificationsBell({ unread, items, onRefresh, onChange }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markOne = useCallback(
    async (notice: PosterNotice) => {
      const res = await fetch("/api/portal/job-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPublicId: notice.publicId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { unread?: number; items?: PosterNotice[] };
        onChange({
          unread: Math.max(0, Number(data.unread) || 0),
          items: data.items ?? items.map((n) => (n.publicId === notice.publicId ? { ...n, readAt: new Date().toISOString() } : n)),
        });
      }
      setOpen(false);
      router.push(notice.href || "/portal/jobs/mine");
      router.refresh();
    },
    [items, onChange, router],
  );

  const markAll = useCallback(async () => {
    const res = await fetch("/api/portal/job-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (res.ok) {
      const data = (await res.json()) as { unread?: number; items?: PosterNotice[] };
      onChange({
        unread: Math.max(0, Number(data.unread) || 0),
        items: data.items ?? items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      });
    }
  }, [items, onChange]);

  const badge = unread > 9 ? "9+" : unread > 0 ? String(unread) : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="hover:bg-dash-muted relative inline-flex rounded-lg p-2"
        aria-label={unread > 0 ? `${unread} peer-help notifications` : "Peer-help notifications"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void onRefresh();
        }}
      >
        <BellIcon />
        {badge ? (
          <span className="bg-dash-accent absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="border-dash-border bg-dash-card absolute top-full right-0 z-[60] mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border shadow-xl"
        >
          <div className="border-dash-border flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
            <div>
              <p className="text-dash-foreground text-sm font-semibold">Your post offers</p>
              <p className="text-dash-muted-foreground text-[11px]">
                {unread > 0 ? `${unread} new` : "No new offers"} · updates live
              </p>
            </div>
            {unread > 0 ? (
              <button type="button" className="text-dash-accent text-[11px] font-semibold" onClick={() => void markAll()}>
                Mark all read
              </button>
            ) : null}
          </div>

          <ul className="max-h-[22rem] overflow-y-auto">
            {items.length === 0 ? (
              <li className="text-dash-muted-foreground px-3.5 py-8 text-center text-sm">
                When someone applies to your peer-help post, it shows here instantly.
              </li>
            ) : (
              items.map((n) => {
                const unreadRow = !n.readAt;
                return (
                  <li
                    key={n.publicId}
                    className={`border-dash-border border-b px-3.5 py-3 last:border-b-0 ${unreadRow ? "bg-dash-accent/5" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-dash-foreground text-sm font-semibold leading-snug">
                          {unreadRow ? <span className="bg-dash-accent mr-1.5 inline-block h-1.5 w-1.5 rounded-full" /> : null}
                          {n.title}
                        </p>
                        <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">{n.body}</p>
                        <p className="text-dash-muted-foreground mt-1 text-[10px] tabular-nums">{timeAgo(n.createdAt)}</p>
                      </div>
                      <button
                        type="button"
                        className="bg-dash-accent inline-flex shrink-0 items-center rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
                        onClick={() => void markOne(n)}
                      >
                        View
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-dash-border border-t px-3.5 py-2.5">
            <Link
              href="/portal/jobs/mine"
              className="text-dash-accent text-xs font-semibold"
              onClick={() => setOpen(false)}
            >
              Open my requests →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg className="text-dash-foreground h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  );
}
