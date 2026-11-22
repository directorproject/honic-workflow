"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Avatar } from "@/components/zimamoto/ui";
import { IconChat, IconSearch } from "@/components/zimamoto/icons";
import { threadActivityAt, type PortalChatThread } from "@/lib/portal/jobs-shared";

/* ------------------------------------------------------------ Read state */

// Per-device read markers (thread id -> ms of newest message seen). No DB table needed.
const READ_KEY = "peerChatRead:v1";
const READ_EVENT = "peer-chat-read";

function readRaw(): string {
  try {
    return window.localStorage.getItem(READ_KEY) ?? "";
  } catch {
    return "";
  }
}

function parseReads(raw: string): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function subscribeReads(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(READ_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(READ_EVENT, onChange);
  };
}

export function useThreadReads(): Record<string, number> {
  const raw = useSyncExternalStore(subscribeReads, readRaw, () => "");
  return useMemo(() => parseReads(raw), [raw]);
}

export function markThreadRead(applicationPublicId: string, createdAtIso: string) {
  const at = Date.parse(createdAtIso);
  if (!applicationPublicId || Number.isNaN(at)) return;
  const reads = parseReads(readRaw());
  if ((reads[applicationPublicId] ?? 0) >= at) return;
  reads[applicationPublicId] = at;
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(reads));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(READ_EVENT));
}

export function unreadCount(thread: PortalChatThread, reads: Record<string, number>): number {
  const seen = reads[thread.applicationPublicId] ?? 0;
  return thread.incomingAt.filter((iso) => Date.parse(iso) > seen).length;
}

/* ------------------------------------------------------------ Live list */

export function useChatThreads(jobPublicId: string | null, initial: PortalChatThread[], enabled = true) {
  const [threads, setThreads] = useState(initial);

  const refresh = useCallback(async () => {
    const url = new URL("/api/portal/jobs/threads", window.location.origin);
    if (jobPublicId) url.searchParams.set("jobPublicId", jobPublicId);
    try {
      const res = await fetch(url.toString(), { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; threads?: PortalChatThread[] };
      if (data.ok && Array.isArray(data.threads)) setThreads(data.threads);
    } catch {
      /* transient — next tick retries */
    }
  }, [jobPublicId]);

  useEffect(() => {
    if (!enabled) return;
    function tick() {
      if (!document.hidden) void refresh();
    }
    const timer = window.setInterval(tick, 3000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, refresh]);

  return { threads, setThreads, refresh };
}

/* ------------------------------------------------------------ UI */

function chatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (t >= startOfToday - 86_400_000) return "Yesterday";
  if (t >= startOfToday - 6 * 86_400_000) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function previewText(t: PortalChatThread): string {
  if (t.lastMessage) return `${t.lastMessage.isMine ? "You: " : ""}${t.lastMessage.body}`;
  if (t.role === "poster") return `New offer: ${t.offerMessage}`;
  return t.posterReplied ? "Say hello" : "Offer sent · waiting for the poster";
}

export function ChatThreadRow({
  thread,
  unread,
  active = false,
  showJobTitle = false,
}: {
  thread: PortalChatThread;
  unread: number;
  active?: boolean;
  showJobTitle?: boolean;
}) {
  const hasUnread = unread > 0;
  return (
    <div className={`flex items-center gap-3 px-3 py-3 transition ${active ? "bg-dash-accent/10" : "hover:bg-dash-muted/50"}`}>
      <Avatar name={thread.counterpartLabel} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-dash-foreground truncate text-sm font-semibold">{thread.counterpartLabel}</p>
          <span className={`shrink-0 text-[11px] tabular-nums ${hasUnread ? "text-dash-accent font-semibold" : "text-dash-muted-foreground"}`}>
            {chatTime(threadActivityAt(thread))}
          </span>
        </div>
        {showJobTitle ? <p className="text-dash-muted-foreground truncate text-[11px]">{thread.jobTitle}</p> : null}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={`truncate text-[13px] ${hasUnread ? "text-dash-foreground font-medium" : "text-dash-muted-foreground"}`}>
            {thread.status === "accepted" ? <span className="text-dash-accent font-semibold">Hired · </span> : null}
            {previewText(thread)}
          </p>
          {hasUnread ? (
            <span className="bg-dash-accent flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function useFilteredThreads(threads: PortalChatThread[], query: string) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      [t.counterpartLabel, t.jobTitle, t.lastMessage?.body ?? "", t.offerMessage].some((s) => s.toLowerCase().includes(q)),
    );
  }, [threads, query]);
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="bg-dash-muted/60 flex items-center gap-2 rounded-xl px-3 py-2">
      <IconSearch size={15} className="text-dash-muted-foreground shrink-0" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search chats"
        className="text-dash-foreground placeholder:text-dash-muted-foreground w-full bg-transparent text-sm outline-none"
      />
    </label>
  );
}

/** Chat list inside a job page: tap a helper to switch chats instantly. */
export function ChatThreadList({
  threads,
  activeId,
  onSelect,
  title,
}: {
  threads: PortalChatThread[];
  activeId: string | null;
  onSelect: (applicationPublicId: string) => void;
  title: string;
}) {
  const reads = useThreadReads();
  const [query, setQuery] = useState("");
  const shown = useFilteredThreads(threads, query);
  const totalUnread = threads.reduce((n, t) => n + unreadCount(t, reads), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-dash-border space-y-2 border-b px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="text-dash-foreground text-sm font-bold">{title}</p>
          {totalUnread ? (
            <span className="text-dash-accent text-xs font-semibold tabular-nums">{totalUnread} unread</span>
          ) : null}
        </div>
        {threads.length > 3 ? <SearchBox value={query} onChange={setQuery} /> : null}
      </div>
      <ul className="divide-dash-border/60 min-h-0 flex-1 divide-y overflow-y-auto">
        {shown.length ? (
          shown.map((t) => (
            <li key={t.applicationPublicId}>
              <button type="button" onClick={() => onSelect(t.applicationPublicId)} className="block w-full text-left">
                <ChatThreadRow thread={t} unread={unreadCount(t, reads)} active={t.applicationPublicId === activeId} />
              </button>
            </li>
          ))
        ) : (
          <li className="text-dash-muted-foreground px-4 py-10 text-center text-sm">
            {threads.length ? "No chats match your search." : "No offers yet. Helpers will appear here."}
          </li>
        )}
      </ul>
    </div>
  );
}

/** All chats across every request and offer, like a WhatsApp inbox. */
export function PeerChatInbox({ threads }: { threads: PortalChatThread[] }) {
  const reads = useThreadReads();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "poster" | "helper">("all");

  const searched = useFilteredThreads(threads, query);
  const shown = searched.filter((t) =>
    filter === "unread" ? unreadCount(t, reads) > 0 : filter === "all" ? true : t.role === filter,
  );
  const filters = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "poster", label: "My requests" },
    { id: "helper", label: "My offers" },
  ] as const;

  return (
    <div className="border-dash-border bg-dash-card overflow-hidden rounded-2xl border">
      <div className="border-dash-border space-y-3 border-b p-3">
        <SearchBox value={query} onChange={setQuery} />
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === f.id ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground hover:text-dash-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <ul className="divide-dash-border/60 divide-y">
          {shown.map((t) => (
            <li key={t.applicationPublicId}>
              <Link href={`/portal/jobs/${t.jobPublicId}?chat=${t.applicationPublicId}`} className="block">
                <ChatThreadRow thread={t} unread={unreadCount(t, reads)} showJobTitle />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-6 py-12 text-center">
          <IconChat size={22} className="text-dash-muted-foreground mx-auto" />
          <p className="text-dash-muted-foreground mt-2 text-sm">
            {threads.length ? "No chats here." : "No chats yet. Offer help or post a request to start one."}
          </p>
        </div>
      )}
    </div>
  );
}

export function useTotalUnread(threads: PortalChatThread[]): number {
  const reads = useThreadReads();
  return threads.reduce((n, t) => n + unreadCount(t, reads), 0);
}
