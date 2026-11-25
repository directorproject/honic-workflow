"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import type { PortalResult } from "@/app/portal/auth-actions";
import {
  portalApplyJobAction,
  portalDeleteJobAction,
  portalJobDetailSyncAction,
  portalLockJobMoneyAction,
  portalMarkJobTakenAction,
  portalPickHelperAction,
  portalPostJobAction,
  portalUpdateJobAction,
} from "@/app/portal/job-actions";
import { JobEscrowPanel } from "@/components/portal/job-escrow-panel";
import { PeerHelpPolicyGate } from "@/components/portal/peer-help-policy-gate";
import { Avatar, Chip } from "@/components/zimamoto/ui";
import {
  ChatThreadList,
  PeerChatInbox,
  markThreadRead,
  unreadCount,
  useChatThreads,
  useThreadReads,
  useTotalUnread,
} from "@/components/portal/peer-chat-inbox";
import { PAYMENT_NETWORKS } from "@/lib/portal/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  PortalJobDeliverableMeta,
  PortalJobEscrow,
  PortalJobEscrowEvent,
} from "@/lib/portal/job-escrow-shared";
import {
  IconBack,
  IconChat,
  IconCheck,
  IconClock,
  IconEdit,
  IconInbox,
  IconLock,
  IconPlus,
  IconSearch,
  IconSend,
  IconShield,
  IconSparkle,
  IconTag,
  IconTrash,
  IconWallet,
} from "@/components/zimamoto/icons";
import { toUserError } from "@/lib/portal/user-errors";
import {
  JOB_CATEGORIES,
  jobRefLabel,
  type PortalChatThread,
  type PortalJob,
  type PortalJobApplication,
  type PortalJobMessage,
} from "@/lib/portal/jobs-shared";
import { formatTsh } from "@/lib/workspace/constants";
import { formatDate, formatDateTime } from "@/lib/workspace/dates";

const INPUT =
  "border-dash-border bg-dash-canvas text-dash-foreground placeholder:text-dash-muted-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2";
const PRIMARY =
  "bg-dash-accent inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";
const SOFT =
  "bg-dash-muted text-dash-foreground inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90";
const CARD = "border-dash-border bg-dash-card rounded-2xl border";

/** Peer-help policy gate wrapper: blocks the page until the student accepts the rules. */
function PolicyWall({ needed, children }: { needed: boolean; children: ReactNode }) {
  // Policy blocks posting/offering on the server; keep browse and Manage links clickable while rules are open.
  return (
    <>
      {needed ? <PeerHelpPolicyGate /> : null}
      <div>{children}</div>
    </>
  );
}

function Hero({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white sm:p-8">
      <div aria-hidden className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10" />
      <div aria-hidden className="absolute right-20 -bottom-16 h-36 w-36 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-white/85 sm:text-base">{subtitle}</p>
        </div>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
      <span className="text-white">{icon}</span>
      <span>
        <span className="block text-lg leading-none font-bold tabular-nums">{value}</span>
        <span className="text-[11px] text-white/80">{label}</span>
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "open" || status === "pending"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "accepted" || status === "assigned"
        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
        : "bg-dash-muted text-dash-muted-foreground";
  const label = status === "assigned" ? "taken" : status;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${tone}`}>{label}</span>;
}

function LockNotice({ children, href, cta }: { children: ReactNode; href: string; cta: string }) {
  return (
    <div className="border-dash-border bg-dash-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
      <p className="text-dash-muted-foreground flex items-start gap-2 text-sm">
        <IconLock size={16} className="text-dash-muted-foreground mt-0.5 shrink-0" />
        <span className="text-dash-foreground">{children}</span>
      </p>
      <Link href={href} className={`${PRIMARY} !py-2`}>
        {cta}
      </Link>
    </div>
  );
}

function JobsPlanGate({ action }: { action: "post" | "apply" }) {
  return (
    <div className={`${CARD} p-5`}>
      <span className="bg-dash-accent/10 text-dash-accent inline-flex h-10 w-10 items-center justify-center rounded-xl">
        <IconLock size={18} />
      </span>
      <h2 className="text-dash-foreground mt-3 text-base font-bold">
        {action === "post" ? "Requesting help needs a plan" : "Offering help needs a plan"}
      </h2>
      <p className="text-dash-muted-foreground mt-1.5 text-sm leading-relaxed">
        You can read every request for free. {action === "post" ? "Posting" : "Offering to help"} needs sign-in and an active
        Nexis Desk plan.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/portal?auth=signin" className={PRIMARY}>
          Sign in
        </Link>
        <Link href="/portal/packs#plans" className={SOFT}>
          See plans
        </Link>
      </div>
    </div>
  );
}

/** Soft live refresh for list pages — no spinner, just pulls new server data. */
function unreadForJob(threads: PortalChatThread[], jobPublicId: string, reads: Record<string, number>): number {
  return threads
    .filter((t) => t.jobPublicId === jobPublicId)
    .reduce((sum, t) => sum + unreadCount(t, reads), 0);
}

function useSoftLiveRefresh(enabled = true, ms = 8000) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const tick = window.setInterval(() => router.refresh(), ms);
    function onFocus() {
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, ms, router]);
}

/* ---------------------------------------------------------------- Browse */

/** Browse open requests. Anyone can read; posting and offering need a Desk plan. */
export function JobsBrowseBoard({
  openJobs,
  canUseJobs,
  guest = false,
  needsPolicy = false,
  threads: initialThreads = [],
  myRequestCount = 0,
  signedIn = false,
}: {
  openJobs: PortalJob[];
  canUseJobs: boolean;
  guest?: boolean;
  needsPolicy?: boolean;
  threads?: PortalChatThread[];
  myRequestCount?: number;
  signedIn?: boolean;
}) {
  useSoftLiveRefresh(!guest);
  const { threads } = useChatThreads(null, initialThreads, !guest);
  const reads = useThreadReads();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "price">("newest");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = openJobs.filter(
      (j) =>
        (cat === "all" || j.category === cat) &&
        (!q || j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q)),
    );
    return [...filtered].sort((a, b) => (sort === "price" ? b.offerTsh - a.offerTsh : a.createdAt < b.createdAt ? 1 : -1));
  }, [openJobs, query, cat, sort]);

  const categoriesInUse = new Set(openJobs.map((j) => j.category));

  return (
    <PolicyWall needed={needsPolicy}>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <Hero
          eyebrow="Honic Nexis · Peer help"
          title="Get help, give help"
          subtitle={
            canUseJobs
              ? "Browse open requests, offer help, and chat anonymously. Peer help only, never ghostwriting."
              : guest
                ? "Preview: read every request. Sign in and join a Desk plan to post or offer help."
                : "Browse for free. Posting and offering help unlock with a Nexis Desk plan."
          }
        >
          <Stat icon={<IconInbox size={20} />} label="open requests" value={openJobs.length} />
          {myRequestCount > 0 ? (
            <Stat icon={<IconEdit size={20} />} label="your requests" value={myRequestCount} />
          ) : null}
          {signedIn && (canUseJobs || myRequestCount > 0) ? (
            <>
              <Link
                href="/portal/jobs/mine"
                className="inline-flex items-center gap-2 self-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-teal-700"
              >
                <IconInbox size={16} /> Manage my requests
              </Link>
              {canUseJobs ? (
                <Link
                  href="/portal/jobs/mine"
                  className="inline-flex items-center gap-2 self-center rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/20"
                >
                  <IconPlus size={16} /> Request help
                </Link>
              ) : null}
            </>
          ) : guest ? (
            <Link href="/portal?auth=signin" className="inline-flex items-center gap-2 self-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-teal-700">
              Sign in
            </Link>
          ) : null}
        </Hero>

        {!canUseJobs && !guest ? (
          myRequestCount > 0 ? (
            <LockNotice href="/portal/jobs/mine" cta="Manage my requests">
              You already have open requests you can manage. Posting or offering on new jobs needs an active Nexis Desk plan.
            </LockNotice>
          ) : (
            <LockNotice href="/portal/packs#plans" cta="See plans">
              Free plan: you can read any request. Posting and offering help need an active Nexis Desk plan.
            </LockNotice>
          )
        ) : null}

        {/* Search, sort, categories */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <IconSearch size={17} className="text-dash-muted-foreground absolute top-1/2 left-3.5 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search requests"
                className={`${INPUT} pl-10`}
              />
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "price")} className={`${INPUT} sm:w-44`}>
              <option value="newest">Newest first</option>
              <option value="price">Highest offer</option>
            </select>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <CategoryChip active={cat === "all"} onClick={() => setCat("all")} label="All" />
            {JOB_CATEGORIES.filter((c) => categoriesInUse.has(c.id)).map((c) => (
              <CategoryChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.label} />
            ))}
          </div>
        </div>

        {/* Feed */}
        {list.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {list.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                canApply={canUseJobs}
                unread={guest ? 0 : unreadForJob(threads, job.publicId, reads)}
              />
            ))}
          </ul>
        ) : (
          <div className={`${CARD} px-6 py-14 text-center`}>
            <span className="bg-dash-muted text-dash-muted-foreground mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl">
              <IconSparkle size={24} />
            </span>
            <p className="text-dash-foreground mt-4 font-semibold">No requests match.</p>
            <p className="text-dash-muted-foreground mt-1 text-sm">
              {openJobs.length ? "Try another search or category." : "Be the first to ask for help."}
            </p>
            {signedIn && myRequestCount > 0 ? (
              <Link href="/portal/jobs/mine" className={`${PRIMARY} mt-5`}>
                <IconInbox size={16} /> Manage my requests
              </Link>
            ) : canUseJobs ? (
              <Link href="/portal/jobs/mine" className={`${PRIMARY} mt-5`}>
                <IconPlus size={16} /> Request help
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </PolicyWall>
  );
}

function CategoryChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active ? "bg-dash-accent text-white shadow-sm" : "bg-dash-muted text-dash-muted-foreground hover:text-dash-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function JobCard({ job, canApply, unread = 0 }: { job: PortalJob; canApply: boolean; unread?: number }) {
  const hasNew = unread > 0;
  return (
    <li className={`${CARD} group flex flex-col overflow-hidden transition hover:shadow-lg hover:border-dash-accent/40 p-0`}>
      {/* Header background */}
      <div className="bg-gradient-to-br from-dash-accent/5 to-transparent px-5 py-4 border-b border-dash-border/50">
        <div className="flex items-start gap-3">
          <Avatar name={job.posterLabel || "Student"} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-dash-foreground font-semibold text-sm truncate">{job.posterLabel || "Student"}</p>
            <p className="text-dash-muted-foreground text-xs mt-0.5">{formatDate(job.createdAt)}</p>
          </div>
          <span className="bg-dash-accent/15 text-dash-accent px-2 py-1 rounded-full text-[11px] font-semibold shrink-0">
            {jobRefLabel(job.publicId)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-5">
        {/* Category & Status */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="bg-dash-muted/40 text-dash-muted-foreground inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold">
            <IconTag size={12} /> {job.categoryLabel}
          </span>
          <span className="text-dash-muted-foreground text-xs">
            {job.priceMode === "negotiable" ? "Negotiable" : "Fixed price"}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-dash-foreground text-lg font-bold leading-snug break-words group-hover:text-dash-accent transition mb-2">
          {job.title}
        </h3>

        {/* Description */}
        <p className="text-dash-muted-foreground text-sm leading-relaxed line-clamp-2 flex-grow">
          {job.description}
        </p>
        {hasNew ? (
          <p className="text-dash-accent mt-2 flex items-center gap-1.5 text-xs font-semibold">
            <IconChat size={14} />
            New message{unread > 1 ? `s (${unread})` : ""}
          </p>
        ) : null}

        {/* Price & Status */}
        <div className="mt-4 pt-4 border-t border-dash-border/30 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-dash-foreground text-2xl font-bold tabular-nums">{formatTsh(job.offerTsh)}</span>
            {job.status && job.status !== "open" ? (
              <StatusChip status={job.status} />
            ) : null}
          </div>
          <Link
            href={`/portal/jobs/${job.publicId}`}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              job.isMine
                ? "border border-dash-border hover:border-dash-accent/40 hover:bg-dash-muted/40 text-dash-foreground"
                : canApply
                  ? "bg-dash-accent text-white hover:bg-dash-accent/90 shadow-sm"
                  : "border border-dash-border text-dash-foreground hover:bg-dash-muted/40"
            }`}
          >
            {job.isMine ? (
              <>
                <IconEdit size={14} /> Manage
                {hasNew ? (
                  <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold tabular-nums">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </>
            ) : canApply ? (
              <>
                <IconSend size={14} /> Offer help
              </>
            ) : (
              <>
                <IconChat size={14} /> View
              </>
            )}
          </Link>
        </div>
      </div>

      {!job.isMine && !canApply ? (
        <div className="border-dash-border bg-dash-muted/30 flex items-center gap-2 border-t px-5 py-2.5">
          <IconLock size={14} className="text-dash-muted-foreground shrink-0" />
          <p className="text-dash-muted-foreground text-xs">Free plan: view only</p>
        </div>
      ) : null}
    </li>
  );
}

/* ---------------------------------------------------------------- My requests */

/** Post and manage your own requests and offers. */
export function MyJobsBoard({
  myJobs,
  myApplications,
  canUseJobs,
  canManageOwn = false,
  needsPolicy = false,
  threads: initialThreads = [],
}: {
  myJobs: PortalJob[];
  myApplications: PortalJobApplication[];
  canUseJobs: boolean;
  /** Open, edit, or delete requests you already posted (does not require Desk for view/manage). */
  canManageOwn?: boolean;
  needsPolicy?: boolean;
  threads?: PortalChatThread[];
}) {
  useSoftLiveRefresh(true, 6000);
  const { threads } = useChatThreads(null, initialThreads);
  const reads = useThreadReads();
  const unread = useTotalUnread(threads);
  const requestsUnread = useMemo(
    () => myJobs.reduce((sum, job) => sum + unreadForJob(threads, job.publicId, reads), 0),
    [myJobs, threads, reads],
  );
  const [tab, setTab] = useState<"chats" | "requests" | "offers">(() =>
    myJobs.length > 0 ? "requests" : "chats",
  );

  return (
    <PolicyWall needed={needsPolicy}>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <Hero
          eyebrow="Honic Nexis · Peer help"
          title="My requests & offers"
          subtitle={
            canUseJobs
              ? "Track the help you asked for and the offers you sent."
              : "Browsing is free. Posting and offering help need an active Nexis Desk plan."
          }
        >
          <Stat icon={<IconChat size={20} />} label="unread" value={unread} />
          <Stat icon={<IconInbox size={20} />} label="requests" value={myJobs.length} />
          <Stat icon={<IconSend size={20} />} label="offers" value={myApplications.length} />
        </Hero>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="bg-dash-muted inline-flex rounded-full p-1 text-sm font-semibold">
            {(
              [
                { id: "chats", label: "Chats", icon: <IconChat size={15} /> },
                { id: "requests", label: "Requests", icon: <IconInbox size={15} /> },
                { id: "offers", label: "Offers", icon: <IconSend size={15} /> },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition sm:px-4 ${
                  tab === t.id ? "bg-dash-card text-dash-foreground shadow-sm" : "text-dash-muted-foreground"
                }`}
              >
                {t.icon}
                {t.label}
                {t.id === "chats" && unread > 0 ? (
                  <span className="bg-dash-accent flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white tabular-nums">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
                {t.id === "requests" && requestsUnread > 0 ? (
                  <span className="bg-dash-accent flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white tabular-nums">
                    {requestsUnread > 99 ? "99+" : requestsUnread}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <Link href="/portal/jobs" className={SOFT}>
            <IconBack size={15} /> Peer help board
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
          <div className="space-y-3">
            {tab === "chats" ? (
              <PeerChatInbox threads={threads} />
            ) : tab === "requests" ? (
              myJobs.length ? (
                myJobs.map((job) => (
                  <ManagedPostRow
                    key={job.id}
                    job={job}
                    canManage={canManageOwn || canUseJobs}
                    unread={unreadForJob(threads, job.publicId, reads)}
                  />
                ))
              ) : (
                <EmptyState title="No requests yet" body="Ask for peer help on a task. Your name stays hidden." />
              )
            ) : myApplications.length ? (
              myApplications.map((app) => (
                <div key={app.id} className={`${CARD} flex flex-wrap items-start justify-between gap-3 p-5`}>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={app.status} />
                      {app.jobPublicId ? <Chip tone="neutral">{jobRefLabel(app.jobPublicId)}</Chip> : null}
                    </div>
                    <p className="text-dash-muted-foreground line-clamp-2 text-sm">{app.message}</p>
                    <p className="text-dash-muted-foreground text-xs">
                      {formatDate(app.createdAt)}
                      {app.proposedTsh != null ? ` · proposed ${formatTsh(app.proposedTsh)}` : ""}
                    </p>
                  </div>
                  {app.jobPublicId ? (
                    <Link href={`/portal/jobs/${app.jobPublicId}`} className={`${SOFT} !py-2`}>
                      Open
                    </Link>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState title="No offers yet" body="Browse requests and offer the help you can give." link={{ href: "/portal/jobs", label: "Browse peer help" }} />
            )}
          </div>

          <aside className="lg:sticky lg:top-24">
            {canUseJobs ? <PostJobForm /> : <JobsPlanGate action="post" />}
          </aside>
        </div>
      </div>
    </PolicyWall>
  );
}

function EmptyState({ title, body, link }: { title: string; body: string; link?: { href: string; label: string } }) {
  return (
    <div className={`${CARD} px-6 py-12 text-center`}>
      <span className="bg-dash-muted text-dash-muted-foreground mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl">
        <IconInbox size={22} />
      </span>
      <p className="text-dash-foreground mt-3 font-semibold">{title}</p>
      <p className="text-dash-muted-foreground mt-1 text-sm">{body}</p>
      {link ? (
        <Link href={link.href} className={`${PRIMARY} mt-4`}>
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}

function ManagedPostRow({ job, canManage, unread = 0 }: { job: PortalJob; canManage: boolean; unread?: number }) {
  const [editing, setEditing] = useState(false);
  const canEdit = canManage && (job.status === "open" || job.status === "assigned");
  const hasNew = unread > 0;

  return (
    <div className={`${CARD} p-5 border-l-4 border-l-dash-accent/50 hover:border-l-dash-accent transition`}>
      <div className="flex flex-col gap-4">
        {/* Top section */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusChip status={job.status} />
              <span className="bg-dash-accent/10 text-dash-accent px-2 py-1 rounded-full text-[11px] font-semibold">
                {jobRefLabel(job.publicId)}
              </span>
              <span className="bg-dash-muted/40 text-dash-muted-foreground px-2 py-1 rounded-full text-[11px] font-semibold">
                {job.categoryLabel}
              </span>
            </div>
            <p className="text-dash-foreground text-lg font-bold leading-snug mb-1">{job.title}</p>
            <div className="text-dash-muted-foreground text-sm space-y-1">
              <p className="font-semibold">{formatTsh(job.offerTsh)} · {job.priceMode === "negotiable" ? "Negotiable" : "Fixed price"}</p>
              <p className="text-xs">Posted {formatDate(job.createdAt)}</p>
              {hasNew ? (
                <p className="text-dash-accent flex items-center gap-1.5 text-xs font-semibold">
                  <IconChat size={14} />
                  New message{unread > 1 ? `s (${unread})` : ""} — open to reply
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Link href={`/portal/jobs/${job.publicId}`} className={`${PRIMARY} !py-2 !px-4 inline-flex items-center gap-2`}>
              <IconEdit size={15} /> Manage
              {hasNew ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold tabular-nums">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className={`${SOFT} !py-2 inline-flex items-center gap-2`}
              >
                <IconEdit size={15} /> {editing ? "Done" : "Edit"}
              </button>
            ) : null}
            {canManage ? <DeleteJobButton jobPublicId={job.publicId} redirectTo="/portal/jobs/mine" /> : null}
          </div>
        </div>

        {/* Edit form */}
        {editing && canEdit ? (
          <div className="mt-2 pt-4 border-t border-dash-border/50">
            <EditJobForm job={job} onDone={() => setEditing(false)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PriceModeChoice({ value, onChange }: { value: "fixed" | "negotiable"; onChange: (v: "fixed" | "negotiable") => void }) {
  const options = [
    { id: "fixed" as const, label: "Fixed", body: "The amount you listed", icon: <IconWallet size={18} /> },
    { id: "negotiable" as const, label: "Negotiable", body: "Talk about it in chat", icon: <IconChat size={18} /> },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Price">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
            value === o.id ? "border-dash-accent bg-dash-accent/5 ring-dash-accent/20 ring-2" : "border-dash-border hover:bg-dash-muted"
          }`}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${value === o.id ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground"}`}>
            {o.icon}
          </span>
          <span>
            <span className="text-dash-foreground block text-sm font-semibold">{o.label}</span>
            <span className="text-dash-muted-foreground block text-xs">{o.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function EditJobForm({ job, onDone }: { job: PortalJob; onDone?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [priceMode, setPriceMode] = useState<"fixed" | "negotiable">(job.priceMode);

  return (
    <form
      className="border-dash-border bg-dash-canvas grid gap-3 rounded-2xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setStatus(null);
        startTransition(async () => {
          const res = await portalUpdateJobAction({
            jobPublicId: job.publicId,
            category: String(fd.get("category") ?? ""),
            title: String(fd.get("title") ?? ""),
            description: String(fd.get("description") ?? ""),
            offerTsh: Number(fd.get("offerTsh")),
            priceMode,
          });
          setStatus(res);
          if (res.ok) {
            onDone?.();
            router.refresh();
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="category" className={INPUT} defaultValue={job.category} required>
          {JOB_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input name="offerTsh" type="number" min={500} step={100} required className={INPUT} defaultValue={job.offerTsh} />
      </div>
      <input name="title" required minLength={8} maxLength={160} className={INPUT} defaultValue={job.title} />
      <textarea name="description" required minLength={20} maxLength={4000} rows={4} className={INPUT} defaultValue={job.description} />
      <PriceModeChoice value={priceMode} onChange={setPriceMode} />
      <button type="submit" className={PRIMARY} disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
      {status ? <p className={`text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>{status.ok ? status.message : toUserError(status.message ?? "")}</p> : null}
    </form>
  );
}

function DeleteJobButton({ jobPublicId, redirectTo }: { jobPublicId: string; redirectTo?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-500/15 disabled:opacity-50 dark:text-red-300"
        onClick={() => {
          if (!window.confirm("Delete this help request? Offers and messages will be removed.")) return;
          setStatus(null);
          startTransition(async () => {
            const res = await portalDeleteJobAction(jobPublicId);
            setStatus(res);
            if (res.ok) {
              if (redirectTo) router.push(redirectTo);
              router.refresh();
            }
          });
        }}
      >
        <IconTrash size={14} /> {pending ? "Deleting…" : "Delete"}
      </button>
      {status && !status.ok ? <span className="text-xs text-red-600 dark:text-red-300">{toUserError(status.message ?? "")}</span> : null}
    </span>
  );
}

function PostJobForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [priceMode, setPriceMode] = useState<"fixed" | "negotiable">("fixed");

  return (
    <section className={`${CARD} p-5 sm:p-6`}>
      <div className="flex items-center gap-3">
        <span className="bg-dash-accent/10 text-dash-accent flex h-10 w-10 items-center justify-center rounded-xl">
          <IconPlus size={18} />
        </span>
        <div>
          <h2 className="text-dash-foreground text-base font-bold">Request help</h2>
          <p className="text-dash-muted-foreground flex items-center gap-1 text-xs">
            <IconShield size={12} /> Anonymous · peer help only
          </p>
        </div>
      </div>
      <form
        id="post-job-form"
        className="mt-5 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setStatus(null);
          startTransition(async () => {
            const res = await portalPostJobAction({
              category: String(fd.get("category") ?? ""),
              title: String(fd.get("title") ?? ""),
              description: String(fd.get("description") ?? ""),
              offerTsh: Number(fd.get("offerTsh")),
              priceMode,
            });
            setStatus(res);
            if (res.ok) {
              (document.getElementById("post-job-form") as HTMLFormElement | null)?.reset();
              setPriceMode("fixed");
              router.refresh();
            }
          });
        }}
      >
        <select name="category" className={INPUT} defaultValue={JOB_CATEGORIES[0].id} required>
          {JOB_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input name="title" required minLength={8} maxLength={160} className={INPUT} placeholder="e.g. Draw block diagram for IoT monitoring" />
        <textarea
          name="description"
          required
          minLength={20}
          maxLength={4000}
          rows={4}
          className={INPUT}
          placeholder="What you need, the deadline, tools, and what you will supply. Not a full report or chapter."
        />
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <input name="offerTsh" type="number" min={500} step={100} required className={INPUT} placeholder="Offer, e.g. 5000" />
          <span className="text-dash-muted-foreground text-xs font-semibold">TSh</span>
        </div>
        <PriceModeChoice value={priceMode} onChange={setPriceMode} />
        <button type="submit" className={`${PRIMARY} w-full`} disabled={pending}>
          {pending ? "Posting…" : "Post request"}
        </button>
        {status ? <p className={`text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>{status.ok ? status.message : toUserError(status.message ?? "")}</p> : null}
      </form>
    </section>
  );
}

/* ---------------------------------------------------------------- Detail */

/** One request: details, offers (for the requester), and the anonymous chat. */
export function JobDetailPanel({
  job,
  applications: initialApplications,
  myApplication: initialMyApplication,
  messagesByApplicationPublicId: initialMessages,
  canUseJobs,
  needsPolicy = false,
  escrow: initialEscrow = null,
  deliverables: initialDeliverables = [],
  events: initialEvents = [],
  peerPayoutSaved = false,
  savedPayout = null,
  isStaff = false,
  threads: initialThreads = [],
  initialChat = null,
}: {
  job: PortalJob;
  applications: PortalJobApplication[];
  myApplication: PortalJobApplication | null;
  messagesByApplicationPublicId: Record<string, PortalJobMessage[]>;
  canUseJobs: boolean;
  needsPolicy?: boolean;
  escrow?: PortalJobEscrow | null;
  deliverables?: PortalJobDeliverableMeta[];
  events?: PortalJobEscrowEvent[];
  peerPayoutSaved?: boolean;
  savedPayout?: { network: string; phoneTail: string } | null;
  isStaff?: boolean;
  threads?: PortalChatThread[];
  initialChat?: string | null;
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [myApplication, setMyApplication] = useState(initialMyApplication);
  const [messagesByApplicationPublicId, setMessagesByApp] = useState(initialMessages);
  const [escrow, setEscrow] = useState(initialEscrow);
  const [deliverables, setDeliverables] = useState(initialDeliverables);
  const [events, setEvents] = useState(initialEvents);
  const [jobStatus, setJobStatus] = useState(job.status);

  useEffect(() => {
    setApplications(initialApplications);
  }, [initialApplications]);
  useEffect(() => {
    setMyApplication(initialMyApplication);
  }, [initialMyApplication]);
  useEffect(() => {
    setMessagesByApp(initialMessages);
  }, [initialMessages]);
  useEffect(() => {
    setEscrow(initialEscrow);
  }, [initialEscrow]);
  useEffect(() => {
    setDeliverables(initialDeliverables);
  }, [initialDeliverables]);
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);
  useEffect(() => {
    setJobStatus(job.status);
  }, [job.status]);

  const posterInbox = job.isMine && !isStaff;
  const { threads: liveThreads, setThreads } = useChatThreads(job.publicId, initialThreads, posterInbox);
  const threads = useMemo(
    () =>
      [...liveThreads].sort(
        (a, b) => Date.parse(b.lastMessage?.createdAt ?? b.createdAt) - Date.parse(a.lastMessage?.createdAt ?? a.createdAt),
      ),
    [liveThreads],
  );

  const [pickedAppId, setActiveAppId] = useState<string | null>(() => {
    if (!job.isMine) return myApplication?.publicId ?? null;
    if (initialChat && initialThreads.some((t) => t.applicationPublicId === initialChat)) return initialChat;
    return initialThreads[0]?.applicationPublicId ?? null;
  });
  // Fall back to the newest chat if the picked one closes (e.g. offer rejected).
  const activeAppId =
    posterInbox && !threads.some((t) => t.applicationPublicId === pickedAppId)
      ? (threads[0]?.applicationPublicId ?? null)
      : pickedAppId;
  // Mobile shows one pane at a time, like WhatsApp: the list, or the open chat.
  const [mobilePane, setMobilePane] = useState<"list" | "chat">(initialChat ? "chat" : "list");
  const [offerOpen, setOfferOpen] = useState(
    () => (initialThreads.find((t) => t.applicationPublicId === pickedAppId)?.messageCount ?? 1) === 0,
  );

  const activeThread = posterInbox ? (threads.find((t) => t.applicationPublicId === activeAppId) ?? null) : null;
  const activeOfferApp = posterInbox ? (applications.find((a) => a.publicId === activeAppId) ?? null) : null;
  const helperApp =
    !job.isMine && myApplication && (myApplication.status === "pending" || myApplication.status === "accepted")
      ? myApplication
      : null;
  const closedOffers = posterInbox ? applications.filter((a) => a.status === "rejected" || a.status === "withdrawn") : [];

  // Lock money once, then one tap picks a helper from their chat.
  const router = useRouter();
  const showLockCard =
    posterInbox &&
    jobStatus === "open" &&
    (!escrow || ["awaiting_funds", "cancelled", "refunded"].includes(escrow.status));
  const moneyLocked = escrow?.status === "funded";
  // After money lock the request is marked taken (assigned) but picking is still allowed.
  const canPick =
    posterInbox &&
    (jobStatus === "open" || jobStatus === "assigned") &&
    activeOfferApp?.status === "pending";
  const lockRef = useRef<HTMLDivElement>(null);
  const [pickNote, setPickNote] = useState<PortalResult | null>(null);
  const [picking, startPick] = useTransition();

  function pickActive() {
    if (!activeOfferApp || !activeThread) return;
    if (!moneyLocked) {
      setPickNote({
        ok: false,
        message:
          escrow?.status === "awaiting_funds"
            ? "Your payment is still confirming. Approve the prompt on your phone, then tap Pick again."
            : "Lock your money first (above), then tap Pick.",
      });
      lockRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const locked = escrow ? formatTsh(escrow.amountTsh) : "";
    const asked =
      activeOfferApp.proposedTsh != null && escrow && Math.round(activeOfferApp.proposedTsh) !== escrow.amountTsh
        ? `\n\nThey asked ${formatTsh(activeOfferApp.proposedTsh)}. They will be paid the ${locked} you locked, so agree on it in chat first.`
        : "";
    if (!window.confirm(`Pick ${activeThread.counterpartLabel} for this request?${asked}\n\nOther offers will close.`)) return;
    setPickNote(null);
    startPick(async () => {
      const res = await portalPickHelperAction(activeOfferApp.publicId);
      setPickNote(res);
      if (res.ok) router.refresh();
    });
  }

  function selectThread(id: string) {
    setActiveAppId(id);
    setPickNote(null);
    setMobilePane("chat");
    setOfferOpen((threads.find((t) => t.applicationPublicId === id)?.messageCount ?? 1) === 0);
    window.history.replaceState(null, "", `?chat=${id}`);
  }

  // Reflect the open chat's newest message in the list right away (the list poll confirms it).
  const handleActivity = useCallback(
    (appId: string, msgs: PortalJobMessage[]) => {
      const newest = msgs.at(-1);
      if (!newest) return;
      setThreads((prev) =>
        prev.map((t) => {
          if (t.applicationPublicId !== appId) return t;
          if (t.lastMessage && Date.parse(t.lastMessage.createdAt) >= Date.parse(newest.createdAt)) return t;
          return { ...t, lastMessage: { body: newest.body, createdAt: newest.createdAt, isMine: newest.isMine } };
        }),
      );
    },
    [setThreads],
  );

  // Live offers + escrow / activity (chat has its own /api poll — do not drive chat via this).
  useEffect(() => {
    let stopped = false;
    async function sync() {
      const res = await portalJobDetailSyncAction({
        jobPublicId: job.publicId,
        applicationPublicId: activeAppId,
        messagesSinceIso: new Date(0).toISOString(),
      });
      if (stopped || !res.ok) return;
      if (job.isMine) setApplications(res.applications);
      else setMyApplication(res.myApplication);
      if (res.jobStatus) setJobStatus(res.jobStatus);
      setEscrow(res.escrow);
      setDeliverables(res.deliverables);
      setEvents(res.events);
    }
    void sync();
    const timer = window.setInterval(() => void sync(), 5000);
    function onFocus() {
      void sync();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [job.publicId, job.isMine, activeAppId]);

  const showApplySlot = !job.isMine && jobStatus === "open" && !myApplication;
  const showAside = !posterInbox && (showApplySlot || Boolean(helperApp));
  const liveJob = jobStatus === job.status ? job : { ...job, status: jobStatus };

  const chatsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (initialChat) chatsRef.current?.scrollIntoView({ block: "start" });
  }, [initialChat]);

  return (
    <PolicyWall needed={needsPolicy}>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/portal/jobs" className={SOFT}>
            <IconBack size={15} /> Peer help
          </Link>
          <Link href="/portal/jobs/mine" className={SOFT}>
            <IconInbox size={15} /> My requests & offers
          </Link>
        </div>

        <div className={`grid gap-6 ${showAside ? "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start" : ""}`}>
          <div className="space-y-6">
            {/* Request card */}
            <section className={`${CARD} overflow-hidden`}>
              <div className="bg-gradient-to-br from-emerald-600/15 via-teal-600/10 to-transparent p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={jobStatus} />
                  <Chip tone="neutral">{jobRefLabel(job.publicId)}</Chip>
                  <Chip tone="neutral">
                    <IconTag size={11} /> {job.categoryLabel}
                  </Chip>
                </div>
                <h1 className="text-dash-foreground mt-3 text-2xl font-bold tracking-tight break-words sm:text-3xl">{job.title}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={job.posterLabel || "Student"} size={36} />
                    <div>
                      <p className="text-dash-foreground text-sm font-semibold">{job.posterLabel}</p>
                      <p className="text-dash-muted-foreground flex items-center gap-1 text-xs">
                        <IconClock size={12} /> {formatDate(job.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-dash-foreground text-2xl font-bold tabular-nums">{formatTsh(job.offerTsh)}</p>
                    <p className="text-dash-muted-foreground text-xs">{job.priceMode === "negotiable" ? "Negotiable" : "Fixed offer"}</p>
                  </div>
                </div>
              </div>
              <div className="border-dash-border border-t p-6">
                <p className="text-dash-foreground text-xs font-semibold tracking-wide uppercase">Details</p>
                <p className="text-dash-foreground mt-2 leading-relaxed whitespace-pre-wrap">{job.description}</p>
              </div>
            </section>

            {job.isMine ? <OwnerTools job={liveJob} canManage={canUseJobs} /> : null}

            {showLockCard ? (
              <div ref={lockRef} className="scroll-mt-24">
                <LockMoneyCard
                  job={job}
                  awaiting={escrow?.status === "awaiting_funds"}
                  hasOffers={threads.length > 0}
                />
              </div>
            ) : escrow ? (
              <JobEscrowPanel
                escrow={escrow}
                deliverables={deliverables}
                events={events}
                peerPayoutSaved={peerPayoutSaved}
                savedPayout={savedPayout}
                isStaff={isStaff}
              />
            ) : null}

            {myApplication ? (
              <div className={`${CARD} flex items-center gap-3 p-4`}>
                <IconCheck size={18} className="text-emerald-600" />
                <p className="text-dash-muted-foreground text-sm">
                  Your offer is <StatusChip status={myApplication.status} />
                  {myApplication.proposedTsh != null ? ` · proposed ${formatTsh(myApplication.proposedTsh)}` : ""}
                </p>
              </div>
            ) : null}

            {posterInbox ? (
              <section ref={chatsRef} className="scroll-mt-24 space-y-2">
                <p className="text-dash-muted-foreground text-xs">
                  {moneyLocked ? (
                    <>
                      Money locked. Open the chat of the helper you want and tap{" "}
                      <span className="text-dash-foreground font-semibold">Pick</span>. Other offers close automatically.
                    </>
                  ) : (
                    <>
                      Chat with any helper. Lock your money once, then tap{" "}
                      <span className="text-dash-foreground font-semibold">Pick</span> in the chat of the helper you want.
                    </>
                  )}
                </p>
                <div className={`${CARD} grid h-[min(40rem,calc(100dvh-7rem))] grid-rows-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)]`}>
                  <div className={`border-dash-border min-h-0 flex-col lg:flex lg:border-r ${mobilePane === "chat" ? "hidden" : "flex"}`}>
                    <ChatThreadList
                      threads={threads}
                      activeId={activeAppId}
                      onSelect={selectThread}
                      title={`Helpers (${threads.length})`}
                    />
                  </div>
                  <div className={`min-h-0 flex-col lg:flex ${mobilePane === "list" ? "hidden" : "flex"}`}>
                    {activeThread ? (
                      <>
                        <div className="border-dash-border flex items-center gap-3 border-b px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setMobilePane("list")}
                            aria-label="Back to chats"
                            className="text-dash-muted-foreground hover:text-dash-foreground -ml-1 rounded-full p-1 lg:hidden"
                          >
                            <IconBack size={18} />
                          </button>
                          <Avatar name={activeThread.counterpartLabel} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="text-dash-foreground truncate text-sm font-bold">{activeThread.counterpartLabel}</p>
                            <p className="text-dash-muted-foreground truncate text-[11px]">
                              {activeThread.status === "accepted" ? "Hired" : "Offer pending"}
                              {activeThread.proposedTsh != null ? ` · proposed ${formatTsh(activeThread.proposedTsh)}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOfferOpen((v) => !v)}
                            aria-pressed={offerOpen}
                            className={`${SOFT} !px-3 !py-1.5 !text-xs`}
                          >
                            {offerOpen ? "Hide offer" : "Offer"}
                          </button>
                          {canPick ? (
                            <button
                              type="button"
                              onClick={pickActive}
                              disabled={picking}
                              className={`${moneyLocked ? PRIMARY : SOFT} !px-3 !py-1.5 !text-xs`}
                            >
                              <IconCheck size={13} /> {picking ? "Picking…" : "Pick"}
                            </button>
                          ) : null}
                        </div>
                        {pickNote ? (
                          <p
                            role="status"
                            className={`border-dash-border border-b px-3 py-2 text-xs ${pickNote.ok ? "text-emerald-700" : "text-red-600"}`}
                          >
                            {pickNote.ok ? pickNote.message : toUserError(pickNote.message ?? "")}
                          </p>
                        ) : null}
                        {offerOpen && activeOfferApp ? (
                          <div className="border-dash-border bg-dash-muted/20 max-h-[45%] shrink-0 overflow-y-auto border-b p-3">
                            <ApplicationRow app={activeOfferApp} />
                          </div>
                        ) : null}
                        <MessageThread
                          key={activeThread.applicationPublicId}
                          embedded
                          paneOpen={mobilePane === "chat"}
                          applicationPublicId={activeThread.applicationPublicId}
                          initialMessages={messagesByApplicationPublicId[activeThread.applicationPublicId] ?? []}
                          canSend={canUseJobs}
                          onActivity={(msgs) => handleActivity(activeThread.applicationPublicId, msgs)}
                        />
                      </>
                    ) : (
                      <div className="text-dash-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm">
                        <IconChat size={26} />
                        {threads.length ? "Pick a helper to open the chat." : "No offers yet. Helpers who offer will show up here."}
                      </div>
                    )}
                  </div>
                </div>
                {closedOffers.length ? (
                  <details className="group">
                    <summary className="text-dash-muted-foreground hover:text-dash-foreground cursor-pointer text-xs font-semibold">
                      Closed offers ({closedOffers.length})
                    </summary>
                    <div className="mt-3 space-y-3">
                      {closedOffers.map((app) => (
                        <ApplicationRow key={app.id} app={app} />
                      ))}
                    </div>
                  </details>
                ) : null}
              </section>
            ) : null}

            {showApplySlot ? (
              <div className="lg:hidden">{canUseJobs ? <ApplyForm job={job} /> : <JobsPlanGate action="apply" />}</div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24">
            {showApplySlot ? (
              <div className="hidden lg:block">{canUseJobs ? <ApplyForm job={job} /> : <JobsPlanGate action="apply" />}</div>
            ) : null}
            {helperApp ? (
              <MessageThread
                key={helperApp.publicId}
                applicationPublicId={helperApp.publicId}
                initialMessages={messagesByApplicationPublicId[helperApp.publicId] ?? []}
                threadFor={job.posterLabel}
                canSend={false}
                unlockOnReply={canUseJobs}
              />
            ) : null}
          </aside>
        </div>
      </div>
    </PolicyWall>
  );
}

function OwnerTools({ job, canManage }: { job: PortalJob; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const canEdit = canManage && job.status === "open";
  const isOpen = job.status === "open";

  return (
    <div className={`${CARD} space-y-3 p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-dash-foreground mr-auto text-sm font-semibold">Your request</p>
        {isOpen ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Mark this request as taken? It will be removed from the open list.")) return;
              setStatus(null);
              startTransition(async () => {
                const res = await portalMarkJobTakenAction(job.publicId);
                setStatus(res);
                if (res.ok) router.refresh();
              });
            }}
            className={`${PRIMARY} !py-2`}
          >
            <IconCheck size={15} /> {pending ? "Saving…" : "Mark as taken"}
          </button>
        ) : null}
        {canEdit ? (
          <button type="button" onClick={() => setEditing((v) => !v)} className={`${SOFT} !py-2`}>
            <IconEdit size={15} /> {editing ? "Cancel edit" : "Edit"}
          </button>
        ) : null}
        {canManage ? <DeleteJobButton jobPublicId={job.publicId} redirectTo="/portal/jobs/mine" /> : null}
      </div>
      {status && !status.ok ? <p className="text-xs text-red-600">{toUserError(status.message ?? "")}</p> : null}
      {!canManage ? <p className="text-dash-muted-foreground text-xs">Editing and deleting need an active Nexis Desk plan.</p> : null}
      {editing && canEdit ? <EditJobForm job={job} onDone={() => setEditing(false)} /> : null}
    </div>
  );
}

function ApplyForm({ job }: { job: PortalJob }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  return (
    <form
      className={`${CARD} grid gap-3 p-5`}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setStatus(null);
        startTransition(async () => {
          const proposed = fd.get("proposedTsh");
          const res = await portalApplyJobAction({
            jobPublicId: job.publicId,
            message: String(fd.get("message") ?? ""),
            proposedTsh: proposed ? Number(proposed) : null,
          });
          setStatus(res);
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="flex items-center gap-3">
        <span className="bg-dash-accent/10 text-dash-accent flex h-10 w-10 items-center justify-center rounded-xl">
          <IconSend size={18} />
        </span>
        <h2 className="text-dash-foreground text-base font-bold">Offer to help</h2>
      </div>
      <textarea
        name="message"
        required
        minLength={10}
        rows={3}
        className={INPUT}
        placeholder="What peer help you can give. Not writing their full report."
      />
      {job.priceMode === "negotiable" ? (
        <input name="proposedTsh" type="number" min={500} step={100} className={INPUT} placeholder={`Your price (optional), e.g. ${job.offerTsh}`} />
      ) : null}
      <button type="submit" className={PRIMARY} disabled={pending}>
        <IconSend size={15} /> {pending ? "Sending…" : "Send offer"}
      </button>
      {status ? <p className={`text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>{status.ok ? status.message : toUserError(status.message ?? "")}</p> : null}
    </form>
  );
}

function ApplicationRow({ app }: { app: PortalJobApplication }) {
  return (
    <article className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar name={app.applicantLabel || "Helper"} size={32} />
          <div>
            <p className="text-dash-foreground text-sm font-semibold">{app.applicantLabel}</p>
            <p className="text-dash-muted-foreground text-[11px]">{formatDateTime(app.createdAt)}</p>
          </div>
        </div>
        <StatusChip status={app.status} />
      </div>
      <p className="text-dash-muted-foreground mt-3 text-sm leading-relaxed">{app.message}</p>
      {app.proposedTsh != null ? <p className="text-dash-foreground mt-2 text-xs font-semibold">Proposed {formatTsh(app.proposedTsh)}</p> : null}
    </article>
  );
}

/** Poster: lock the request's money once. After that, any chat has a one-tap Pick. */
function LockMoneyCard({ job, awaiting, hasOffers }: { job: PortalJob; awaiting: boolean; hasOffers: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<(PortalResult & { awaitingPayment?: boolean }) | null>(null);
  const [network, setNetwork] = useState<string>(PAYMENT_NETWORKS[0]);
  const [phone, setPhone] = useState("");
  const waiting = awaiting || Boolean(status?.ok && status.awaitingPayment);

  // While waiting for PIN confirmation, refresh often so a missed webhook still clears.
  useEffect(() => {
    if (!waiting) return;
    const tick = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(tick);
  }, [waiting, router]);

  return (
    <section className={`${CARD} p-5`}>
      <div className="flex items-start gap-3">
        <span className="bg-dash-muted text-dash-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <IconLock size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-dash-foreground text-base font-bold">
            {waiting ? "Waiting for your payment…" : `Lock ${formatTsh(job.offerTsh)} to pick a helper`}
          </h2>
          <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed">
            {waiting
              ? "Enter your PIN on the phone prompt. This page updates by itself once the money is locked."
              : `Your money goes into Honic escrow, not to anyone yet. Then pick ${hasOffers ? "any helper" : "a helper"} with one tap in their chat. The helper is paid only after you approve the work.`}
          </p>
        </div>
      </div>
      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          setStatus(null);
          startTransition(async () => {
            const res = await portalLockJobMoneyAction(job.publicId, network, phone);
            setStatus(res);
            if (res.ok) window.setTimeout(() => router.refresh(), res.awaitingPayment ? 4000 : 0);
          });
        }}
      >
        <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end">
          <select className={INPUT} value={network} onChange={(e) => setNetwork(e.target.value)} aria-label="Mobile money">
            {PAYMENT_NETWORKS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <input
            className={INPUT}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XXXXXXXX"
            inputMode="tel"
            aria-label="Phone number"
            required
          />
          <button type="submit" className={PRIMARY} disabled={pending}>
            <IconWallet size={15} /> {pending ? "Sending prompt…" : waiting ? "Send prompt again" : `Lock ${formatTsh(job.offerTsh)}`}
          </button>
        </div>
      </form>
      {status ? (
        <p role="status" className={`mt-2 text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>
          {status.ok ? status.message : toUserError(status.message ?? "")}
        </p>
      ) : null}
    </section>
  );
}

function mergeJobMessages(prev: PortalJobMessage[], incoming: PortalJobMessage[]): PortalJobMessage[] {
  if (!incoming.length) return prev;
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function MessageThread({
  applicationPublicId,
  initialMessages,
  threadFor,
  canSend: canSendNow,
  unlockOnReply = false,
  embedded = false,
  paneOpen = true,
  onActivity,
}: {
  applicationPublicId: string;
  initialMessages: PortalJobMessage[];
  threadFor?: string;
  canSend: boolean;
  /** Helper side: sending opens as soon as the poster's first reply arrives. */
  unlockOnReply?: boolean;
  /** Rendered inside the inbox pane (parent draws the card and header). */
  embedded?: boolean;
  /** Changes when a mobile pane is shown, so read-marking re-checks visibility. */
  paneOpen?: boolean;
  onActivity?: (messages: PortalJobMessage[]) => void;
}) {
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const listRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const lastRef = useRef(initialMessages.at(-1)?.createdAt ?? new Date(0).toISOString());
  const appBootRef = useRef(applicationPublicId);
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  });

  const otherSideReplied = messages.some((m) => !m.isMine);
  const canSend = canSendNow || (unlockOnReply && otherSideReplied);
  const waitingForPoster = unlockOnReply && !otherSideReplied;

  // Drop any leftover Realtime channels from older peer-help builds (shared Supabase singleton).
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    for (const ch of client.getChannels()) {
      if (ch.topic.includes("peer-help-chat")) {
        void client.removeChannel(ch);
      }
    }
  }, [applicationPublicId]);

  // Only reset when switching threads — never clobber optimistic bubbles from parent polls.
  useEffect(() => {
    if (appBootRef.current === applicationPublicId) return;
    appBootRef.current = applicationPublicId;
    setMessages(initialMessages);
    lastRef.current = initialMessages.at(-1)?.createdAt ?? new Date(0).toISOString();
    setDraft("");
    setStatus(null);
    // intentionally only when the thread id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationPublicId]);

  const applyIncoming = useCallback((incoming: PortalJobMessage[]) => {
    if (!incoming.length) return;
    const newest = incoming[incoming.length - 1].createdAt;
    if (newest > lastRef.current) lastRef.current = newest;
    setMessages((prev) => {
      const withoutDupTemps = prev.filter((m) => {
        if (!String(m.id).startsWith("temp-")) return true;
        return !incoming.some((n) => n.isMine && n.body === m.body);
      });
      return mergeJobMessages(withoutDupTemps, incoming);
    });
  }, []);

  // Cursor = newest message we hold, so nothing sent between page load and the first poll is missed.
  const sync = useCallback(async () => {
    try {
      const url = new URL("/api/portal/jobs/messages", window.location.origin);
      url.searchParams.set("applicationPublicId", applicationPublicId);
      url.searchParams.set("sinceIso", lastRef.current);
      const res = await fetch(url.toString(), { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; messages?: PortalJobMessage[] };
      if (data.ok && data.messages?.length) applyIncoming(data.messages);
    } catch {
      /* transient — next tick retries */
    }
  }, [applicationPublicId, applyIncoming]);

  useEffect(() => {
    function tick() {
      if (!document.hidden) void sync();
    }
    tick();
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [sync]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, applicationPublicId]);

  useEffect(() => {
    onActivityRef.current?.(messages);
  }, [messages]);

  // Mark read only while this chat is actually on screen (hidden mobile panes have no offsetParent).
  useEffect(() => {
    function markIfVisible() {
      const newest = [...messages].reverse().find((m) => !String(m.id).startsWith("temp-"));
      if (!newest || document.hidden || !listRef.current?.offsetParent) return;
      markThreadRead(applicationPublicId, newest.createdAt);
    }
    markIfVisible();
    window.addEventListener("focus", markIfVisible);
    document.addEventListener("visibilitychange", markIfVisible);
    window.addEventListener("resize", markIfVisible);
    return () => {
      window.removeEventListener("focus", markIfVisible);
      document.removeEventListener("visibilitychange", markIfVisible);
      window.removeEventListener("resize", markIfVisible);
    };
  }, [messages, applicationPublicId, paneOpen]);

  function send() {
    if (!canSend) return;
    const body = draft.trim();
    if (!body) return;
    setStatus(null);

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: PortalJobMessage = {
      id: tempId,
      senderPublicId: "me",
      senderLabel: "You",
      body,
      createdAt: new Date().toISOString(),
      isMine: true,
    };

    // Bubble shows and the box clears at once; the keyboard stays up for the next message.
    setDraft("");
    setMessages((prev) => [...prev, optimistic]);

    draftRef.current?.focus();

    // Send in background - no UI blocking
    void (async () => {
      try {
        const res = await fetch("/api/portal/jobs/messages", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationPublicId, body }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; message?: string; chat?: PortalJobMessage }
          | null;
        if (res.ok && data?.ok && data.chat) {
          // Don't move the poll cursor here: an incoming message older than ours may not be fetched yet.
          setMessages((prev) => mergeJobMessages(prev.filter((m) => m.id !== tempId), [data.chat!]));
        } else {
          // Network error: remove temp message and show error
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setDraft(body);
          setStatus({ ok: false, message: data?.message || "Could not send. Try again." });
          // Refocus on error so user can retry
          draftRef.current?.focus();
        }
      } catch {
        // Network error: remove temp message and show error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setDraft(body);
        setStatus({ ok: false, message: "Could not send. Try again." });
        // Refocus on error so user can retry
        draftRef.current?.focus();
      }
    })();
  }

  return (
    <section
      data-peer-help-chat="poll-v4"
      className={
        embedded
          ? "flex min-h-0 flex-1 flex-col"
          : `${CARD} flex h-[min(34rem,75vh)] flex-col overflow-hidden lg:h-[min(36rem,calc(100vh-8rem))]`
      }
    >
      <header className={`border-dash-border items-center justify-between gap-2 border-b px-4 py-3 ${embedded ? "hidden" : "flex"}`}>
        <div className="flex items-center gap-2">
          <span className="bg-dash-accent/10 text-dash-accent flex h-9 w-9 items-center justify-center rounded-full">
            <IconChat size={17} />
          </span>
          <div>
            <p className="text-dash-foreground text-sm font-bold">{threadFor ? `Chat · ${threadFor}` : "Chat"}</p>
            <p className="text-dash-muted-foreground text-[11px]">
              {canSend ? "Anonymous · instant send" : "View only on the free plan"}
            </p>
          </div>
        </div>
      </header>

      <div ref={listRef} className="bg-dash-muted/30 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!messages.length ? (
          <p className="text-dash-muted-foreground py-10 text-center text-sm">
            {canSend ? "No messages yet. Say hello below." : "No messages yet."}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex items-end gap-2 ${m.isMine ? "justify-end" : "justify-start"}`}>
              {!m.isMine ? <Avatar name={m.senderLabel || "?"} size={26} /> : null}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  m.isMine ? "bg-dash-accent rounded-br-md text-white" : "border-dash-border bg-dash-card text-dash-foreground rounded-bl-md border"
                }`}
              >
                <p className={`text-[10px] font-semibold ${m.isMine ? "text-white/75" : "text-dash-muted-foreground"}`}>
                  {m.isMine ? "You" : m.senderLabel}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                <p className={`mt-1 text-right text-[10px] tabular-nums ${m.isMine ? "text-white/70" : "text-dash-muted-foreground"}`}>
                  {formatDateTime(m.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className="border-dash-border border-t px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {!canSend && waitingForPoster ? (
          <div className="flex items-center gap-2 rounded-xl bg-sky-500/10 px-3 py-2.5 text-xs text-sky-900 dark:text-sky-200">
            <IconClock size={14} /> Waiting for the poster to reply. You can chat once they answer.
          </div>
        ) : !canSend ? (
          <div className="border-dash-border bg-dash-muted/40 flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5">
            <p className="text-dash-muted-foreground flex items-center gap-2 text-xs">
              <IconLock size={14} className="shrink-0" /> Messaging is part of the paid plan.
            </p>
            <Link href="/portal/packs#plans" className="text-dash-accent text-xs font-semibold">
              See plans
            </Link>
          </div>
        ) : (
          <>
            <div className="border-dash-border bg-dash-canvas flex items-end gap-2 rounded-2xl border px-2 py-1.5">
              <textarea
                ref={draftRef}
                name="body"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                maxLength={2000}
                placeholder="Message…"
                className="text-dash-foreground placeholder:text-dash-muted-foreground max-h-28 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send message"
                className="bg-dash-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
              >
                <IconSend size={16} />
              </button>
            </div>
            {status && !status.ok ? <p className="mt-2 text-xs text-red-600">{toUserError(status.message ?? "")}</p> : null}
          </>
        )}
      </form>
    </section>
  );
}
