"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { portalZimamotoCreateGroupAction, portalZimamotoJoinGroupAction } from "@/app/portal/zimamoto-actions";
import type { ZimamotoGroup, ZimamotoPost } from "@/lib/portal/zimamoto";
import type { ZimamotoPublicGroup } from "@/lib/portal/zimamoto-chat";
import {
  IconCompass,
  IconFile,
  IconGlobe,
  IconHome,
  IconLock,
  IconPlus,
  IconUsers,
} from "@/components/zimamoto/icons";
import { Avatar } from "@/components/zimamoto/ui";

type Props = {
  guest: boolean;
  groups: ZimamotoGroup[];
  publicGroups: ZimamotoPublicGroup[];
  publicPosts: ZimamotoPost[];
};

const NAV = [
  { href: "#feed", label: "Home", icon: IconHome },
  { href: "#groups", label: "My groups", icon: IconUsers },
  { href: "#discover", label: "Discover", icon: IconCompass },
  { href: "#create", label: "Create", icon: IconPlus },
];

export function ZimamotoHub({ guest, groups, publicGroups, publicPosts }: Props) {
  return (
    <div className="mx-auto w-full max-w-6xl pb-24 lg:pb-10">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* Left navigation (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="text-dash-foreground px-3 pb-3 text-lg font-bold tracking-tight">Zimamoto</p>
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-dash-foreground hover:bg-dash-muted flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
              >
                <n.icon size={20} />
                {n.label}
              </a>
            ))}
            <a href="#create" className="bg-dash-accent mt-4 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white">
              <IconPlus size={18} />
              New group
            </a>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          {/* Hero */}
          <section id="feed" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-sky-600 to-indigo-700 p-6 text-white sm:p-8">
            <div aria-hidden className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
            <div aria-hidden className="absolute right-16 bottom-0 h-28 w-28 rounded-full bg-white/10" />
            <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">Zimamoto</p>
            <h1 className="mt-2 max-w-md text-2xl font-bold tracking-tight sm:text-3xl">Study together. Share everything.</h1>
            <p className="mt-2 max-w-md text-sm text-white/85">Chat with your group, share papers, and keep every file in one place.</p>
            {guest ? (
              <Link href="/portal?auth=signin" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700">
                Sign in to join
              </Link>
            ) : (
              <a href="#create" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700">
                <IconPlus size={16} /> Start a group
              </a>
            )}
          </section>

          {/* My groups as stories */}
          {!guest ? (
            <section id="groups" className="space-y-3">
              <SectionTitle title="My groups" />
              {groups.length === 0 ? (
                <p className="border-dash-border text-dash-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
                  You are not in a group yet. Join a public group below or start your own.
                </p>
              ) : (
                <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
                  {groups.map((g) => (
                    <Link key={g.id} href={`/portal/zimamoto/g/${g.publicId}`} className="flex w-20 shrink-0 flex-col items-center gap-2 text-center">
                      <span className="rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 p-[2.5px]">
                        <span className="bg-dash-card block rounded-full p-[2px]">
                          <Avatar name={g.name} size={60} />
                        </span>
                      </span>
                      <span className="text-dash-foreground line-clamp-1 w-full text-xs font-medium">{g.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* Discover */}
          <section id="discover" className="space-y-3">
            <SectionTitle title="Discover public groups" hint="Anyone can join these" />
            {publicGroups.length === 0 ? (
              <p className="border-dash-border text-dash-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
                No public groups yet.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {publicGroups.map((g) => (
                  <GroupCard key={g.publicId} g={g} guest={guest} />
                ))}
              </div>
            )}
          </section>

          {/* Feed */}
          <section id="board" className="space-y-3">
            <SectionTitle title="Shared on the public board" />
            {publicPosts.length === 0 ? (
              <p className="border-dash-border text-dash-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
                Nothing shared yet.
              </p>
            ) : (
              <div className="space-y-4">
                {publicPosts.map((p) => (
                  <PostCard key={p.id} p={p} guest={guest} />
                ))}
              </div>
            )}
          </section>

          {/* Create + join (mobile and tablet: inline) */}
          <div className="space-y-6 xl:hidden">
            {!guest ? <CreateGroupCard /> : null}
            {!guest ? <JoinCard /> : null}
          </div>
        </main>

        {/* Right column (wide screens) */}
        {!guest ? (
          <aside className="hidden space-y-6 xl:block">
            <div className="sticky top-24 space-y-6">
              <div id="create">
                <CreateGroupCard />
              </div>
              <JoinCard />
            </div>
          </aside>
        ) : null}
      </div>

      {/* Mobile bottom bar with icons */}
      <nav className="border-dash-border bg-dash-card/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md justify-around py-2">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-dash-muted-foreground flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium">
              <n.icon size={22} />
              {n.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-dash-foreground text-lg font-bold tracking-tight">{title}</h2>
      {hint ? <p className="text-dash-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function GroupCard({ g, guest }: { g: ZimamotoPublicGroup; guest: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function join() {
    setMessage(null);
    start(async () => {
      const res = await portalZimamotoJoinGroupAction(g.publicId);
      if (!res.ok) {
        setMessage(res.message ?? "Could not join.");
        return;
      }
      router.push(`/portal/zimamoto/g/${g.publicId}`);
    });
  }

  return (
    <article className="border-dash-border bg-dash-card flex flex-col rounded-2xl border p-5 transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar name={g.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-dash-foreground truncate font-semibold">{g.name}</p>
          <p className="text-dash-muted-foreground flex items-center gap-1 text-xs">
            <IconUsers size={14} /> {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      {g.description ? <p className="text-dash-muted-foreground mt-3 line-clamp-2 text-sm leading-relaxed">{g.description}</p> : null}
      <div className="mt-4">
        {g.isMember ? (
          <Link href={`/portal/zimamoto/g/${g.publicId}`} className="bg-dash-muted text-dash-foreground inline-flex rounded-full px-4 py-1.5 text-sm font-semibold">
            Open chat
          </Link>
        ) : guest ? (
          <Link href="/portal?auth=signin" className="bg-dash-accent inline-flex rounded-full px-4 py-1.5 text-sm font-semibold text-white">
            Sign in to join
          </Link>
        ) : (
          <button type="button" onClick={join} disabled={pending} className="bg-dash-accent inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
            <IconPlus size={14} /> {pending ? "Joining…" : "Join"}
          </button>
        )}
        {message ? <p className="mt-2 text-xs text-red-600">{message}</p> : null}
      </div>
    </article>
  );
}

function PostCard({ p, guest }: { p: ZimamotoPost; guest: boolean }) {
  return (
    <article className="border-dash-border bg-dash-card rounded-2xl border p-5">
      <div className="flex items-center gap-3">
        <Avatar name={p.authorName} size={40} />
        <div className="min-w-0">
          <p className="text-dash-foreground text-sm font-semibold">{p.authorName}</p>
          <p className="text-dash-muted-foreground text-xs">
            {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>
      <p className="text-dash-foreground mt-3 font-semibold">{p.title}</p>
      {p.body ? <p className="text-dash-muted-foreground mt-1 line-clamp-3 text-sm leading-relaxed">{p.body}</p> : null}
      {p.hasPaper && !guest ? (
        <a
          href={`/api/portal/zimamoto/file?kind=post&id=${p.publicId}`}
          target="_blank"
          rel="noreferrer"
          className="border-dash-border bg-dash-canvas/60 hover:bg-dash-muted mt-4 flex items-center gap-3 rounded-xl border p-3"
        >
          <span className="bg-dash-accent/15 text-dash-accent flex h-9 w-9 items-center justify-center rounded-lg">
            <IconFile size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-dash-foreground block truncate text-sm font-medium">{p.paperFileName ?? "Attachment"}</span>
            <span className="text-dash-muted-foreground text-xs">Tap to open</span>
          </span>
        </a>
      ) : null}
    </article>
  );
}

function CreateGroupCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<"public" | "private">("public");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setMessage(null);
    start(async () => {
      const res = await portalZimamotoCreateGroupAction({ name, description, isPrivate: access === "private" });
      if (!res.ok || !res.publicId) {
        setMessage(res.message ?? "Could not create the group.");
        return;
      }
      router.push(`/portal/zimamoto/g/${res.publicId}`);
    });
  }

  return (
    <section className="border-dash-border bg-dash-card rounded-2xl border p-5">
      <h2 className="text-dash-foreground text-base font-bold">Create a group</h2>
      <div className="mt-4 grid gap-3">
        <input
          className="border-dash-border bg-dash-canvas text-dash-foreground placeholder:text-dash-muted-foreground rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-dash-accent/25"
          placeholder="Group name"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="border-dash-border bg-dash-canvas text-dash-foreground placeholder:text-dash-muted-foreground min-h-16 rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-dash-accent/25"
          placeholder="What is it about? (optional)"
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid gap-2">
          <AccessOption
            selected={access === "public"}
            onSelect={() => setAccess("public")}
            icon={<IconGlobe size={18} />}
            title="Public group"
            body="Anyone can find it and join. Good for open study circles."
          />
          <AccessOption
            selected={access === "private"}
            onSelect={() => setAccess("private")}
            icon={<IconLock size={18} />}
            title="Private group"
            body="Invitation only. Only the admin can send invitations."
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pending || name.trim().length < 3}
          className="bg-dash-accent rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create group"}
        </button>
        {message ? <p className="text-dash-muted-foreground text-xs">{message}</p> : null}
      </div>
    </section>
  );
}

function AccessOption({
  selected,
  onSelect,
  icon,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
        selected ? "border-dash-accent bg-dash-accent/5 ring-dash-accent/20 ring-2" : "border-dash-border hover:bg-dash-muted"
      }`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground"}`}>
        {icon}
      </span>
      <span>
        <span className="text-dash-foreground block text-sm font-semibold">{title}</span>
        <span className="text-dash-muted-foreground mt-0.5 block text-xs leading-relaxed">{body}</span>
      </span>
    </button>
  );
}

function JoinCard() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setMessage(null);
    start(async () => {
      const res = await portalZimamotoJoinGroupAction(code);
      if (!res.ok || !res.publicId) {
        setMessage(res.message ?? "Could not join.");
        return;
      }
      router.push(`/portal/zimamoto/g/${res.publicId}`);
    });
  }

  return (
    <section className="border-dash-border bg-dash-card rounded-2xl border p-5">
      <h2 className="text-dash-foreground text-base font-bold">Have an invitation?</h2>
      <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">
        Private groups join by invitation from the admin. Paste the code here.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Invitation code"
          className="border-dash-border bg-dash-canvas text-dash-foreground min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-dash-accent/25"
        />
        <button type="button" onClick={submit} disabled={pending || code.trim().length < 16} className="bg-dash-foreground text-dash-canvas shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">
          Join
        </button>
      </div>
      {message ? <p className="text-dash-muted-foreground mt-2 text-xs">{message}</p> : null}
    </section>
  );
}
