"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { markMessagesReadAction, sendMessageAction } from "@/app/portal/workspace-actions";
import { PaidPlanGate } from "@/components/portal/paid-plan-gate";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, Empty, INPUT, Status } from "@/components/workspace/ws-ui";
import { formatDateTime } from "@/lib/workspace/dates";
import type { Message } from "@/lib/workspace/types";

export function MessagesSection({ messages }: { messages: Message[] }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const [body, setBody] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const deskLocked = viewer.kind === "student" && viewer.hasPaidDesk === false;

  useEffect(() => {
    void markMessagesReadAction(workspaceId);
  }, [workspaceId, messages.length]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  useEffect(() => {
    const tick = window.setInterval(() => router.refresh(), 8_000);
    return () => window.clearInterval(tick);
  }, [router]);

  const mine = (m: Message) => (viewer.kind === "staff" ? m.author_kind === "staff" : m.author_id === viewer.userId);

  if (deskLocked) {
    return (
      <PaidPlanGate
        title="Help desk needs a paid plan"
        body="Free plan can use the blank workspace and browse Jobs. Help desk messages stay locked until you activate a semester or full-year Nexis Desk plan."
      />
    );
  }

  return (
    <div className="border-dash-border bg-dash-card flex min-h-[65vh] flex-col overflow-hidden rounded-2xl border shadow-sm">
      <header className="border-dash-border border-b px-4 py-3">
        <p className="text-dash-foreground text-sm font-semibold">Help desk</p>
        <p className="text-dash-muted-foreground text-xs">
          {viewer.kind === "staff"
            ? "Chat with this student team in the portal."
            : "Chat with Honic staff in the portal."}
        </p>
      </header>

      <div className="bg-dash-muted/20 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4">
        {messages.length ? (
          messages.map((m) => (
            <div key={m.id} className={`flex ${mine(m) ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  mine(m)
                    ? "bg-dash-accent rounded-br-md text-white"
                    : "border-dash-border bg-dash-card text-dash-foreground rounded-bl-md border"
                }`}
              >
                <p className={`mb-0.5 text-[11px] font-semibold ${mine(m) ? "text-white/80" : "text-dash-muted-foreground"}`}>
                  {m.author_kind === "staff" ? "Honic" : m.author_name} · {formatDateTime(m.created_at)}
                </p>
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          ))
        ) : (
          <Empty title="No messages yet">
            {viewer.kind === "staff"
              ? "Send the first message to this team."
              : "Say hello and tell Honic where you are with the project."}
          </Empty>
        )}
        <div ref={end} />
      </div>

      {viewer.canEdit ? (
        <form
          className="border-dash-border flex gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => sendMessageAction(workspaceId, body), { onOk: () => setBody("") });
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && body.trim()) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
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
      ) : null}
      <div className="px-3 pb-2">
        <Status status={status} />
      </div>
    </div>
  );
}
