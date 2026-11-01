"use client";

import { useEffect, useRef, useState } from "react";

import { markMessagesReadAction, sendMessageAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, Empty, INPUT, Panel, Status } from "@/components/workspace/ws-ui";
import { formatDateTime } from "@/lib/workspace/dates";
import type { Message } from "@/lib/workspace/types";

export function MessagesSection({ messages }: { messages: Message[] }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const [body, setBody] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void markMessagesReadAction(workspaceId);
  }, [workspaceId, messages.length]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const mine = (m: Message) => (viewer.kind === "staff" ? m.author_kind === "staff" : m.author_id === viewer.userId);

  return (
    <Panel
      title="Messages with Honic"
      subtitle={viewer.kind === "staff" ? "Students get an email and phone alert when you reply." : "Ask questions, share progress or request help. Honic replies here and you get an alert."}
    >
      <div className="bg-dash-muted/30 max-h-[60vh] min-h-64 space-y-3 overflow-y-auto rounded-xl p-3">
        {messages.length ? (
          messages.map((m) => (
            <div key={m.id} className={`flex ${mine(m) ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  mine(m) ? "bg-dash-accent text-white" : m.author_kind === "staff" ? "border-dash-border bg-dash-card border" : "border-dash-border bg-dash-card border"
                }`}
              >
                <p className={`mb-0.5 text-[11px] font-semibold ${mine(m) ? "text-white/80" : "text-dash-muted-foreground"}`}>
                  {m.author_name}
                  {m.author_kind === "staff" ? " · Honic" : ""} · {formatDateTime(m.created_at)}
                </p>
                <p className="break-words whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          ))
        ) : (
          <Empty title="No messages yet">{viewer.kind === "staff" ? "Send the first message to the team." : "Say hello and tell Honic where you are with the project."}</Empty>
        )}
        <div ref={end} />
      </div>
      {viewer.canEdit ? (
        <form
          className="mt-3 flex gap-2"
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
            placeholder="Write a message (Enter to send, Shift+Enter for a new line)"
            className={INPUT}
          />
          <button type="submit" disabled={pending || !body.trim()} className={`${BTN} self-end`}>
            {pending ? "Sending…" : "Send"}
          </button>
        </form>
      ) : null}
      <div className="mt-2">
        <Status status={status} />
      </div>
    </Panel>
  );
}
