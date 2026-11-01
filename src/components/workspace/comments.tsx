"use client";

import { useState } from "react";

import { addCommentAction, deleteCommentAction, supervisorCommentAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN, BTN_DANGER, INPUT, Status } from "@/components/workspace/ws-ui";
import { formatDateTime } from "@/lib/workspace/dates";
import type { Comment } from "@/lib/workspace/types";

const KIND_BADGE: Record<string, { label: string; tone: string }> = {
  staff: { label: "Honic", tone: "bg-dash-accent/15 text-dash-accent" },
  supervisor: { label: "Supervisor", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  student: { label: "Student", tone: "bg-dash-muted text-dash-muted-foreground" },
};

export function CommentsThread({
  targetType,
  targetId,
  comments,
}: {
  targetType: "document" | "logbook";
  targetId: string;
  comments: Comment[];
}) {
  const { workspaceId, viewer, supervisorToken } = useWs();
  const { run, pending, status } = useRun();
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const list = comments.filter((c) => c.target_type === targetType && c.target_id === targetId);

  return (
    <div className="mt-3 space-y-2">
      {list.map((c) => {
        const b = KIND_BADGE[c.author_kind] ?? KIND_BADGE.student;
        return (
          <div key={c.id} className="bg-dash-muted/40 rounded-xl px-3 py-2 text-sm">
            <div className="mb-0.5 flex flex-wrap items-center gap-2">
              <span className="text-dash-foreground font-semibold">{c.author_name}</span>
              <Badge className={b.tone}>{b.label}</Badge>
              <span className="text-dash-muted-foreground text-xs">{formatDateTime(c.created_at)}</span>
              {viewer.canEdit && (viewer.kind === "staff" || c.author_kind === viewer.kind) ? (
                <button type="button" className={`${BTN_DANGER} ml-auto`} onClick={() => run(() => deleteCommentAction(workspaceId, c.id))}>
                  Delete
                </button>
              ) : null}
            </div>
            <p className="text-dash-foreground whitespace-pre-wrap">{c.body}</p>
          </div>
        );
      })}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              supervisorToken
                ? supervisorCommentAction(supervisorToken, targetType, targetId, name, body)
                : addCommentAction(workspaceId, targetType, targetId, body),
            { onOk: () => setBody("") },
          );
        }}
      >
        {supervisorToken ? (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={80} className={`${INPUT} sm:w-40`} />
        ) : null}
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={viewer.kind === "student" ? "Add a note or reply" : "Write feedback"}
          maxLength={3000}
          className={INPUT}
        />
        <button type="submit" disabled={pending || !body.trim()} className={BTN}>
          {pending ? "Sending…" : "Comment"}
        </button>
      </form>
      <Status status={status} />
    </div>
  );
}
