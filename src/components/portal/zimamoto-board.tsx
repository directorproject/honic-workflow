"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  portalZimamotoCreateGroupAction,
  portalZimamotoCreatePostAction,
  portalZimamotoJoinGroupAction,
  portalZimamotoSaveDocAction,
  portalZimamotoUploadUrlAction,
} from "@/app/portal/zimamoto-actions";
import { Card, Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import type { ZimamotoDoc, ZimamotoGroup, ZimamotoPost } from "@/lib/portal/zimamoto";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";
import { createClient } from "@supabase/supabase-js";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function shortInvite(publicId: string): string {
  return publicId.slice(0, 12);
}

function uploadViaSignedUrl(path: string, token: string, file: File): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Promise.reject(new Error("Upload is not configured."));
  const client = createClient(url, key);
  return client.storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(path, token, file, { contentType: file.type || "application/octet-stream" })
    .then(({ error }) => {
      if (error) throw new Error(error.message);
    });
}

export function ZimamotoBoard({
  guest,
  publicPosts,
  groups,
}: {
  guest: boolean;
  publicPosts: ZimamotoPost[];
  groups: ZimamotoGroup[];
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-12">
      <header className="border-dash-border bg-dash-card rounded-2xl border px-4 py-6 sm:px-8 sm:py-8">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">Honic Nexis</p>
        <h1 className="text-dash-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Zimamoto</h1>
        <p className="text-dash-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
          A study forum for every signed-in student — free plan included. Share papers on the public board, create groups with
          classmates, and keep a private document library your group can open anytime.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-8">
          {guest ? (
            <p className="text-dash-muted-foreground border-dash-border bg-dash-card rounded-xl border px-4 py-3 text-sm">
              Sign in to post papers, create groups, and save private documents.{" "}
              <Link href="/portal?auth=signin" className="text-dash-accent font-semibold">
                Sign in
              </Link>
            </p>
          ) : (
            <SharePostForm groupId={null} groupLabel="Public forum" />
          )}

          <section>
            <h2 className="text-dash-foreground text-lg font-semibold">Public papers & posts</h2>
            <ul className="mt-4 space-y-4">
              {publicPosts.length ? (
                publicPosts.map((post) => <PostCard key={post.id} post={post} guest={guest} />)
              ) : (
                <li className="text-dash-muted-foreground text-sm">No public posts yet. Be the first to share a paper.</li>
              )}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          {!guest ? (
            <>
              <CreateGroupPanel />
              <JoinGroupPanel />
            </>
          ) : null}
          <Card title="Your groups" subtitle={guest ? "Sign in to join groups." : "Open a group to post and save files."}>
            {groups.length ? (
              <ul className="space-y-2">
                {groups.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/portal/zimamoto/g/${g.publicId}`}
                      className="text-dash-accent block text-sm font-semibold hover:underline"
                    >
                      {g.name}
                    </Link>
                    <p className="text-dash-muted-foreground text-xs">
                      Invite: <span className="font-mono">{shortInvite(g.publicId)}</span>
                      {g.isPrivate ? " · private" : " · open"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-dash-muted-foreground text-sm">No groups yet. Create one or join with a classmate&apos;s code.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function ZimamotoGroupPage({
  guest,
  group,
  posts,
  docs,
}: {
  guest: boolean;
  group: ZimamotoGroup & { memberCount: number };
  posts: ZimamotoPost[];
  docs: ZimamotoDoc[];
}) {
  const [tab, setTab] = useState<"posts" | "library">("posts");

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <header className="border-dash-border bg-dash-card rounded-2xl border px-4 py-6 sm:px-8">
        <Link href="/portal/zimamoto" className="text-dash-muted-foreground text-xs font-semibold hover:text-dash-foreground">
          ← Zimamoto
        </Link>
        <h1 className="text-dash-foreground mt-3 text-2xl font-semibold">{group.name}</h1>
        {group.description ? <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">{group.description}</p> : null}
        <p className="text-dash-muted-foreground mt-3 text-xs">
          {group.memberCount} member{group.memberCount === 1 ? "" : "s"} · Invite code:{" "}
          <span className="text-dash-foreground font-mono">{shortInvite(group.publicId)}</span>
          {group.isPrivate ? " · Private group" : " · Open group"}
        </p>
      </header>

      {guest ? (
        <p className="text-dash-muted-foreground text-sm">Sign in to post or open the group library.</p>
      ) : group.isMember ? (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("posts")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "posts" ? "bg-dash-foreground text-dash-card" : "bg-dash-muted text-dash-muted-foreground"}`}
            >
              Group forum
            </button>
            <button
              type="button"
              onClick={() => setTab("library")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === "library" ? "bg-dash-foreground text-dash-card" : "bg-dash-muted text-dash-muted-foreground"}`}
            >
              Saved documents
            </button>
          </div>
          {tab === "posts" ? (
            <>
              <SharePostForm groupId={group.id} groupLabel={group.name} />
              <ul className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} guest={false} />
                ))}
              </ul>
            </>
          ) : (
            <>
              <SaveDocForm groupId={group.id} />
              <ul className="mt-6 space-y-3">
                {docs.map((doc) => (
                  <li key={doc.id} className="border-dash-border bg-dash-card rounded-xl border px-4 py-3">
                    <p className="text-dash-foreground font-semibold">{doc.title}</p>
                    {doc.notes ? <p className="text-dash-muted-foreground mt-1 text-sm">{doc.notes}</p> : null}
                    <p className="text-dash-muted-foreground mt-2 text-xs">
                      {doc.fileName} · {formatBytes(doc.sizeBytes)} · {doc.uploaderName}
                    </p>
                    <a
                      href={`/api/portal/zimamoto/file?kind=doc&id=${encodeURIComponent(doc.publicId)}`}
                      className="text-dash-accent mt-2 inline-block text-sm font-semibold"
                    >
                      Open file
                    </a>
                  </li>
                ))}
                {!docs.length ? <li className="text-dash-muted-foreground text-sm">No documents saved yet.</li> : null}
              </ul>
            </>
          )}
        </>
      ) : (
        <JoinGroupPanel presetMessage="Join this group to see posts and the saved document library." defaultCode={group.publicId} />
      )}
    </div>
  );
}

function PostCard({ post, guest }: { post: ZimamotoPost; guest: boolean }) {
  return (
    <article className="border-dash-border bg-dash-card rounded-xl border px-4 py-4">
      <h3 className="text-dash-foreground font-semibold">{post.title}</h3>
      <p className="text-dash-muted-foreground mt-1 text-xs">
        {post.authorName} · {new Date(post.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
      </p>
      {post.body ? <p className="text-dash-muted-foreground mt-3 text-sm leading-relaxed whitespace-pre-wrap">{post.body}</p> : null}
      {post.hasPaper ? (
        guest ? (
          <p className="text-dash-muted-foreground mt-3 text-sm">Sign in to download the attached paper.</p>
        ) : (
          <a
            href={`/api/portal/zimamoto/file?kind=post&id=${encodeURIComponent(post.publicId)}`}
            className="text-dash-accent mt-3 inline-flex text-sm font-semibold"
          >
            Download {post.paperFileName ?? "paper"}
            {post.paperSizeBytes ? ` (${formatBytes(post.paperSizeBytes)})` : ""}
          </a>
        )
      ) : null}
    </article>
  );
}

function SharePostForm({ groupId, groupLabel }: { groupId: string | null; groupLabel: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!file && !title.trim() && !body.trim()) {
      setStatus({ ok: false, message: "Attach a file or add a short note." });
      return;
    }
    start(async () => {
      setStatus(null);
      let paperPath: string | null = null;
      try {
        if (file) {
          const prep = await portalZimamotoUploadUrlAction({
            groupId,
            fileName: file.name,
            sizeBytes: file.size,
          });
          if (!prep.ok || !prep.path || !prep.token) {
            setStatus({ ok: false, message: prep.message });
            return;
          }
          await uploadViaSignedUrl(prep.path, prep.token, file);
          paperPath = prep.path;
        }
        const result = await portalZimamotoCreatePostAction({
          groupId,
          title,
          body,
          paperPath,
          paperFileName: file?.name ?? null,
          paperSizeBytes: file?.size ?? null,
          paperMimeType: file?.type ?? null,
        });
        setStatus(result);
        if (result.ok) {
          setTitle("");
          setBody("");
          setFile(null);
          router.refresh();
        }
      } catch (err) {
        setStatus({ ok: false, message: err instanceof Error ? err.message : "Upload failed." });
      }
    });
  }

  return (
    <Card title={`Share in ${groupLabel}`} subtitle="Attach a file only, or add title and notes if you want.">
      <div className="space-y-4">
        <Field label="Title (optional)">
          <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Uses file name when left blank" />
        </Field>
        <Field label="Notes (optional)" wide>
          <textarea className={`${INPUT} min-h-[88px]`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Summary, chapter, or context" />
        </Field>
        <Field label="Attach paper" wide>
          <input type="file" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" />
        </Field>
        <StatusText status={status} />
        <button type="button" className={PRIMARY} disabled={pending} onClick={submit}>
          {pending ? "Publishing…" : "Publish"}
        </button>
      </div>
    </Card>
  );
}

function SaveDocForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!file) {
      setStatus({ ok: false, message: "Choose a file to save." });
      return;
    }
    start(async () => {
      setStatus(null);
      try {
        const prep = await portalZimamotoUploadUrlAction({ groupId, fileName: file.name, sizeBytes: file.size });
        if (!prep.ok || !prep.path || !prep.token) {
          setStatus({ ok: false, message: prep.message });
          return;
        }
        await uploadViaSignedUrl(prep.path, prep.token, file);
        const result = await portalZimamotoSaveDocAction({
          groupId,
          title,
          notes,
          storagePath: prep.path,
          fileName: file.name,
          sizeBytes: file.size,
          mimeType: file.type || null,
        });
        setStatus(result);
        if (result.ok) {
          setTitle("");
          setNotes("");
          setFile(null);
          router.refresh();
        }
      } catch (err) {
        setStatus({ ok: false, message: err instanceof Error ? err.message : "Could not save." });
      }
    });
  }

  return (
    <Card title="Save to group library" subtitle="Private to group members — available anytime.">
      <div className="space-y-4">
        <Field label="Document name (optional)">
          <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to file name" />
        </Field>
        <Field label="Notes (optional)" wide>
          <input className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="File" wide>
          <input type="file" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <StatusText status={status} />
        <button type="button" className={PRIMARY} disabled={pending} onClick={submit}>
          {pending ? "Saving…" : "Save document"}
        </button>
      </div>
    </Card>
  );
}

function CreateGroupPanel() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [status, setStatus] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const result = await portalZimamotoCreateGroupAction({ name, description, isPrivate });
      setStatus(result);
      if (result.ok) {
        setName("");
        setDescription("");
        router.refresh();
        if (result.publicId) router.push(`/portal/zimamoto/g/${result.publicId}`);
      }
    });
  }

  return (
    <Card title="Create a group">
      <div className="space-y-3">
        <Field label="Name">
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DIT ETE BENG22" />
        </Field>
        <Field label="About" wide>
          <textarea className={`${INPUT} min-h-[64px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          Private (invite code required)
        </label>
        <StatusText status={status} />
        <button type="button" className={PRIMARY} disabled={pending} onClick={submit}>
          Create group
        </button>
      </div>
    </Card>
  );
}

function JoinGroupPanel({ presetMessage, defaultCode }: { presetMessage?: string; defaultCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(defaultCode ?? "");
  const [status, setStatus] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const result = await portalZimamotoJoinGroupAction(code);
      setStatus(result);
      if (result.ok && result.publicId) {
        router.push(`/portal/zimamoto/g/${result.publicId}`);
        router.refresh();
      }
    });
  }

  return (
    <Card title="Join a group">
      <p className="text-dash-muted-foreground mb-3 text-xs">{presetMessage ?? "Paste the invite code from your group owner."}</p>
      <Field label="Invite code">
        <input className={INPUT} value={code} onChange={(e) => setCode(e.target.value)} placeholder="First 12+ characters" />
      </Field>
      <StatusText status={status} />
      <button type="button" className={`${SECONDARY} mt-3`} disabled={pending} onClick={submit}>
        Join
      </button>
    </Card>
  );
}