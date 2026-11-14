"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { markMessagesReadAction, sendMessageAction } from "@/app/portal/workspace-actions";
import { BTN, INPUT } from "@/components/workspace/ws-ui";
import { formatDateTime } from "@/lib/workspace/dates";
import type { HelpDeskThread } from "@/lib/workspace/load";
import type { Message } from "@/lib/workspace/types";

export function HelpDeskMessenger({
  threads,
  selectedId,
  messages,
}: {
  threads: HelpDeskThread[];
  selectedId: string | null;
  messages: Message[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const selected = threads.find((t) => t.workspaceId === selectedId) ?? null;

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((t) =>
      `${t.workspaceName} ${t.membersLabel} ${t.lastBody}`.toLowerCase().includes(needle),
    );
  }, [threads, query]);

  useEffect(() => {
    if (!selectedId) return;
    void markMessagesReadAction(selectedId);
  }, [selectedId, messages.length]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [selectedId, messages.length]);

  useEffect(() => {
    const tick = window.setInterval(() => router.refresh(), 8_000);
    return () => window.clearInterval(tick);
  }, [router]);

  function openThread(id: string) {
    router.push(`/students/help-desk?c=${encodeURIComponent(id)}`);
  }

  function send() {
    if (!selectedId || !body.trim() || pending) return;
    const text = body;
    setError(null);
    startTransition(async () => {
      const res = await sendMessageAction(selectedId, text);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="border-dash-border bg-dash-card grid min-h-[70vh] overflow-hidden rounded-2xl border shadow-sm lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="border-dash-border flex min-h-[40vh] flex-col border-b lg:min-h-0 lg:border-r lg:border-b-0">
        <div className="border-dash-border border-b p-3">
          <p className="text-dash-foreground text-sm font-semibold">Conversations</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search project or student"
            className={`${INPUT} mt-2`}
            aria-label="Search conversations"
          />
        </div>
        <ul className="flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <li className="text-dash-muted-foreground px-4 py-8 text-center text-sm">No conversations yet.</li>
          ) : (
            list.map((t) => {
              const on = t.workspaceId === selectedId;
              return (
                <li key={t.workspaceId}>
                  <button
                    type="button"
                    onClick={() => openThread(t.workspaceId)}
                    className={`w-full px-3 py-3 text-left transition-colors ${
                      on ? "bg-dash-accent/10" : "hover:bg-dash-muted/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-dash-foreground line-clamp-1 text-sm font-semibold">{t.workspaceName}</p>
                      {t.unread > 0 ? (
                        <span className="bg-dash-accent inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                          {t.unread > 99 ? "99+" : t.unread}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-dash-muted-foreground mt-0.5 line-clamp-1 text-xs">{t.membersLabel}</p>
                    <p className="text-dash-muted-foreground mt-1 line-clamp-2 text-xs">
                      {t.lastAuthorKind === "staff" ? "You: " : `${t.lastAuthorName}: `}
                      {t.lastBody}
                    </p>
                    <p className="text-dash-muted-foreground mt-1 text-[10px] tabular-nums">{formatDateTime(t.lastAt)}</p>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      <section className="flex min-h-[50vh] flex-col lg:min-h-0">
        {selected ? (
          <>
            <header className="border-dash-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0">
                <p className="text-dash-foreground truncate text-sm font-semibold">{selected.workspaceName}</p>
                <p className="text-dash-muted-foreground truncate text-xs">{selected.membersLabel}</p>
              </div>
              <Link
                href={`/students/${selected.workspaceId}`}
                className="text-dash-muted-foreground hover:text-dash-foreground shrink-0 text-xs font-semibold"
              >
                Workspace →
              </Link>
            </header>

            <div className="bg-dash-muted/20 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4">
              {messages.length === 0 ? (
                <p className="text-dash-muted-foreground py-16 text-center text-sm">No messages in this chat yet.</p>
              ) : (
                messages.map((m) => {
                  const mine = m.author_kind === "staff";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                          mine
                            ? "bg-dash-accent rounded-br-md text-white"
                            : "border-dash-border bg-dash-card text-dash-foreground rounded-bl-md border"
                        }`}
                      >
                        <p className={`mb-0.5 text-[11px] font-semibold ${mine ? "text-white/80" : "text-dash-muted-foreground"}`}>
                          {mine ? "Honic" : m.author_name} · {formatDateTime(m.created_at)}
                        </p>
                        <p className="break-words whitespace-pre-wrap">{m.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={end} />
            </div>

            <form
              className="border-dash-border flex gap-2 border-t p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && body.trim()) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                maxLength={4000}
                placeholder="Type a message…"
                className={INPUT}
              />
              <button type="submit" disabled={pending || !body.trim()} className={`${BTN} self-end`}>
                {pending ? "…" : "Send"}
              </button>
            </form>
            {error ? <p className="px-3 pb-3 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
          </>
        ) : (
          <div className="text-dash-muted-foreground flex flex-1 items-center justify-center px-6 text-center text-sm">
            Select a conversation to read and reply.
          </div>
        )}
      </section>
    </div>
  );
}
