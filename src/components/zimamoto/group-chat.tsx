"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { PortalResult } from "@/app/portal/auth-actions";
import { portalZimamotoJoinGroupAction, portalZimamotoUploadUrlAction } from "@/app/portal/zimamoto-actions";
import { GroupFiles } from "@/components/zimamoto/group-files";
import { InvitePanel } from "@/components/zimamoto/invite-panel";
import {
  IconBack,
  IconChat,
  IconClip,
  IconFolder,
  IconGlobe,
  IconLock,
  IconPlus,
  IconSend,
  IconUserPlus,
  IconUsers,
} from "@/components/zimamoto/icons";
import { Avatar, Chip } from "@/components/zimamoto/ui";
import { portalZimamotoMessagesSinceAction, portalZimamotoSendMessageAction } from "@/app/portal/zimamoto-chat-actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ZimamotoMessage } from "@/lib/portal/zimamoto-chat";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

export type GroupInfo = {
  id: string;
  publicId: string;
  name: string;
  description: string;
  isPrivate: boolean;
  isOwner: boolean;
  isMember: boolean;
  memberCount: number;
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const POLL_MS = 15000;

export function GroupChat({
  group,
  initialMessages,
  viewerName,
}: {
  group: GroupInfo;
  initialMessages: ZimamotoMessage[];
  viewerName: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"chat" | "files">("chat");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const focusDone = useCallback(() => setFocusKey(null), []);
  const [messages, setMessages] = useState<ZimamotoMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSend] = useTransition();
  const [joining, startJoin] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const lastRef = useRef(initialMessages.at(-1)?.createdAt ?? new Date(0).toISOString());

  const sync = useCallback(async () => {
    if (!group.isMember) return;
    const res = await portalZimamotoMessagesSinceAction({ groupId: group.id, sinceIso: lastRef.current });
    if (!res.ok || res.messages.length === 0) return;
    lastRef.current = res.messages[res.messages.length - 1].createdAt;
    setMessages((prev) => mergeMessages(prev, res.messages));
  }, [group.id, group.isMember]);

  // Live: Realtime pings on each new row, then we fetch the full message. Polling covers dropped sockets.
  useEffect(() => {
    if (!group.isMember) return;
    const client = getSupabaseBrowserClient();
    const channel = client
      ?.channel(`zimamoto-group-${group.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "zimamoto_messages", filter: `group_id=eq.${group.id}` },
        () => void sync(),
      )
      .subscribe();
    const timer = setInterval(() => void sync(), POLL_MS);
    return () => {
      clearInterval(timer);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [group.id, group.isMember, sync]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, tab]);

  function onPickFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("Files can be up to 25 MB.");
      return;
    }
    setPendingFile(file);
  }

  function send() {
    const text = draft.trim();
    if (!text && !pendingFile) return;
    setError(null);
    startSend(async () => {
      let file: { storagePath: string; fileName: string; sizeBytes: number; mimeType: string | null } | null = null;
      if (pendingFile) {
        const up = await portalZimamotoUploadUrlAction({
          groupId: group.id,
          fileName: pendingFile.name,
          sizeBytes: pendingFile.size,
        });
        if (!up.ok || !up.path || !up.token) {
          setError(up.message ?? "Upload failed. Try again.");
          return;
        }
        const client = getSupabaseBrowserClient();
        if (!client) {
          setError("Uploads are unavailable right now.");
          return;
        }
        const { error: upErr } = await client.storage
          .from(STORAGE_BUCKET)
          .uploadToSignedUrl(up.path, up.token, pendingFile, { contentType: pendingFile.type || "application/octet-stream" });
        if (upErr) {
          setError(upErr.message);
          return;
        }
        file = {
          storagePath: up.path,
          fileName: pendingFile.name,
          sizeBytes: pendingFile.size,
          mimeType: pendingFile.type || null,
        };
      }

      const res = await portalZimamotoSendMessageAction({ groupId: group.id, body: text, file });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      if (res.chatMessage) {
        lastRef.current = res.chatMessage.createdAt;
        setMessages((prev) => mergeMessages(prev, [res.chatMessage!]));
      }
      setDraft("");
      setPendingFile(null);
      if (fileInput.current) fileInput.current.value = "";
    });
  }

  function join() {
    startJoin(async () => {
      const res: PortalResult & { publicId?: string } = await portalZimamotoJoinGroupAction(group.publicId);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-dash-border bg-dash-card">
      {/* Header */}
      <header className="border-dash-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/portal/zimamoto" aria-label="Back to Zimamoto" className="text-dash-muted-foreground hover:bg-dash-muted shrink-0 rounded-full p-1.5">
            <IconBack size={20} />
          </Link>
          <Avatar name={group.name} size={42} />
          <div className="min-w-0">
            <p className="flex items-center gap-2">
              <span className="text-dash-foreground truncate font-bold">{group.name}</span>
              <Chip tone={group.isPrivate ? "private" : "public"}>
                {group.isPrivate ? <IconLock size={11} /> : <IconGlobe size={11} />}
                {group.isPrivate ? "Private" : "Public"}
              </Chip>
            </p>
            <p className="text-dash-muted-foreground flex items-center gap-1 truncate text-xs">
              <IconUsers size={13} /> {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
              {group.description ? <span className="truncate">· {group.description}</span> : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {group.isOwner && group.isPrivate && group.isMember ? (
            <button
              type="button"
              onClick={() => setInviting(true)}
              className="bg-dash-accent flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-white"
            >
              <IconUserPlus size={15} /> Invite
            </button>
          ) : null}
          {group.isMember ? (
            <nav className="bg-dash-muted inline-flex rounded-full p-1 text-xs font-semibold">
              {(
                [
                  { id: "chat", label: "Chat", icon: <IconChat size={15} /> },
                  { id: "files", label: "Files", icon: <IconFolder size={15} /> },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${tab === t.id ? "bg-dash-card text-dash-foreground shadow-sm" : "text-dash-muted-foreground"}`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      {inviting ? <InvitePanel groupId={group.id} groupName={group.name} onClose={() => setInviting(false)} /> : null}

      {!group.isMember ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Avatar name={group.name} size={72} />
          <p className="text-dash-foreground text-lg font-bold">{group.name}</p>
          {group.isPrivate ? (
            <>
              <p className="text-dash-muted-foreground flex items-center gap-1.5 text-sm">
                <IconLock size={15} /> Invitation only
              </p>
              <p className="text-dash-muted-foreground max-w-sm text-sm">
                This is a private group. Ask the admin for an invitation code, then join from Zimamoto.
              </p>
              <Link href="/portal/zimamoto" className="bg-dash-muted text-dash-foreground rounded-full px-5 py-2.5 text-sm font-semibold">
                Back to Zimamoto
              </Link>
            </>
          ) : (
            <>
              <p className="text-dash-muted-foreground flex items-center gap-1.5 text-sm">
                <IconGlobe size={15} /> Public group · anyone can join
              </p>
              <button
                type="button"
                onClick={join}
                disabled={joining}
                className="bg-dash-accent flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <IconPlus size={16} /> {joining ? "Joining…" : "Join group"}
              </button>
            </>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : tab === "files" ? (
        <GroupFiles groupId={group.id} focusKey={focusKey} onFocusDone={focusDone} />
      ) : (
        <>
          <div ref={scroller} className="flex-1 space-y-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgba(100,116,139,0.12)_1px,transparent_0)] [background-size:18px_18px] px-3 py-4 sm:px-6">
            {messages.length === 0 ? (
              <p className="text-dash-muted-foreground py-16 text-center text-sm">No messages yet. Say hello, or share a file.</p>
            ) : null}
            {grouped.map((block) => (
              <div key={block.day} className="space-y-1">
                <div className="sticky top-0 z-[1] my-3 flex justify-center">
                  <span className="bg-dash-card/90 text-dash-muted-foreground rounded-full border border-dash-border px-3 py-0.5 text-[11px] font-semibold">
                    {block.label}
                  </span>
                </div>
                {block.items.map((m) => (
                  <Bubble
                    key={m.id}
                    m={m}
                    onShowInFiles={() => {
                      setFocusKey(`message:${m.id}`);
                      setTab("files");
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="border-t border-dash-border bg-dash-card px-3 py-3 sm:px-4">
            {pendingFile ? (
              <div className="bg-dash-muted mb-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm">
                <span className="text-dash-foreground truncate">
                  📎 {pendingFile.name} <span className="text-dash-muted-foreground">· {formatBytes(pendingFile.size)}</span>
                </span>
                <button type="button" className="text-dash-muted-foreground text-xs font-semibold" onClick={() => setPendingFile(null)}>
                  Remove
                </button>
              </div>
            ) : null}
            {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
            <div className="flex items-end gap-2">
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={sending}
                className="border-dash-border text-dash-foreground hover:bg-dash-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg disabled:opacity-50"
                aria-label="Attach a file"
              >
                <IconClip size={18} />
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder={`Message as ${viewerName.split(" ")[0] || "you"}…`}
                className="border-dash-border bg-dash-canvas text-dash-foreground placeholder:text-dash-muted-foreground max-h-32 min-h-10 flex-1 resize-none rounded-2xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-dash-accent/25"
              />
              <button
                type="button"
                onClick={send}
                disabled={sending || (!draft.trim() && !pendingFile)}
                aria-label="Send message"
                className="bg-dash-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50"
              >
                <IconSend size={17} />
              </button>
            </div>
            <p className="text-dash-muted-foreground mt-2 text-[11px]">Enter sends · Shift+Enter for a new line · Files up to 25 MB, kept in the group history</p>
          </div>
        </>
      )}
    </div>
  );
}

function Bubble({ m, onShowInFiles }: { m: ZimamotoMessage; onShowInFiles: () => void }) {
  return (
    <div className={`flex items-end gap-2 ${m.isMine ? "justify-end" : "justify-start"}`}>
      {!m.isMine ? <Avatar name={m.authorName} size={28} /> : null}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${
          m.isMine ? "rounded-br-md bg-dash-accent/15 text-dash-foreground" : "rounded-bl-md bg-dash-card text-dash-foreground border border-dash-border"
        }`}
      >
        {!m.isMine ? <p className="text-dash-accent mb-0.5 text-xs font-semibold">{m.authorName}</p> : null}
        {m.body ? <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p> : null}
        {m.fileRemoved ? (
          <p className="border-dash-border text-dash-muted-foreground mt-1.5 rounded-xl border border-dashed px-3 py-2 text-xs italic">
            File removed by the uploader or group owner.
          </p>
        ) : m.fileName ? (
          <div className="mt-1.5 flex items-stretch gap-2">
            <a
              href={`/api/portal/zimamoto/file?kind=message&id=${m.id}`}
              target="_blank"
              rel="noreferrer"
              className="border-dash-border bg-dash-canvas/70 hover:bg-dash-muted flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-2"
            >
              <span className="text-lg" aria-hidden>
                📄
              </span>
              <span className="min-w-0">
                <span className="text-dash-foreground block truncate text-sm font-semibold">{m.fileName}</span>
                <span className="text-dash-muted-foreground text-xs">{m.sizeBytes ? formatBytes(m.sizeBytes) : "File"} · Open</span>
              </span>
            </a>
            <button type="button" onClick={onShowInFiles} className="text-dash-accent shrink-0 self-center text-[11px] font-semibold" title="Show this file in the Files tab">
              In files
            </button>
          </div>
        ) : null}
        <p className="text-dash-muted-foreground mt-1 text-right text-[10px] tabular-nums">{formatTime(m.createdAt)}</p>
      </div>
    </div>
  );
}

function mergeMessages(prev: ZimamotoMessage[], incoming: ZimamotoMessage[]): ZimamotoMessage[] {
  const seen = new Set(prev.map((m) => m.id));
  const fresh = incoming.filter((m) => !seen.has(m.id));
  if (!fresh.length) return prev;
  return [...prev, ...fresh].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

function groupByDay(messages: ZimamotoMessage[]) {
  const blocks: { day: string; label: string; items: ZimamotoMessage[] }[] = [];
  for (const m of messages) {
    const day = new Date(m.createdAt).toDateString();
    const last = blocks[blocks.length - 1];
    if (last && last.day === day) last.items.push(m);
    else blocks.push({ day, label: dayLabel(m.createdAt), items: [m] });
  }
  return blocks;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
