"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import type { PortalResult } from "@/app/portal/auth-actions";
import {
  portalAcceptJobApplicationAction,
  portalApplyJobAction,
  portalDeleteJobAction,
  portalJobMessageAction,
  portalPostJobAction,
  portalUpdateJobAction,
} from "@/app/portal/job-actions";
import { Field, StatusText } from "@/components/portal/portal-ui";

const INPUT =
  "border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-sm border px-3 py-2.5 text-sm outline-none focus:ring-2";
const PRIMARY =
  "bg-dash-accent inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-wait disabled:opacity-60";
import {
  JOB_CATEGORIES,
  jobRefLabel,
  type PortalJob,
  type PortalJobApplication,
  type PortalJobMessage,
} from "@/lib/portal/jobs-shared";
import { formatTsh } from "@/lib/workspace/constants";
import { formatDate, formatDateTime } from "@/lib/workspace/dates";

function JobsTabs({ active }: { active: "browse" | "mine" }) {
  const tab = "rounded-sm px-3 py-1.5 text-sm font-medium transition";
  const on = "bg-dash-accent text-white";
  const off = "text-dash-muted-foreground hover:text-dash-foreground";
  return (
    <nav className="inline-flex items-center gap-1" aria-label="Jobs pages">
      <Link href="/portal/jobs" className={`${tab} ${active === "browse" ? on : off}`}>
        My jobs
      </Link>
      <Link href="/portal/jobs/mine" className={`${tab} ${active === "mine" ? on : off}`}>
        Manage jobs
      </Link>
    </nav>
  );
}

/** Browse open jobs (view free; apply needs paid plan). */
export function JobsBrowseBoard({
  openJobs,
  canUseJobs,
}: {
  openJobs: PortalJob[];
  canUseJobs: boolean;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">Honic Nexis</p>
          <h1 className="text-dash-foreground mt-1 text-3xl font-semibold tracking-tight">My jobs</h1>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            {canUseJobs
              ? "Open listings — view details and apply."
              : "Free plan: view all jobs. Upgrade to apply."}
          </p>
        </div>
        <JobsTabs active="browse" />
      </header>

      {!canUseJobs ? (
        <div className="border-dash-border bg-dash-card flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3">
          <p className="text-dash-muted-foreground text-sm">
            You can open any job to read it. Applying needs an active Nexis Desk plan.
          </p>
          <Link href="/portal/packs" className={`${PRIMARY} shrink-0`}>
            View plans
          </Link>
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">Open now</h2>
          <p className="text-dash-muted-foreground text-sm tabular-nums">{openJobs.length}</p>
        </div>
        {openJobs.length ? (
          <ul className="grid gap-3">
            {openJobs.map((job) => (
              <JobCard key={job.id} job={job} canApply={canUseJobs} />
            ))}
          </ul>
        ) : (
          <div className="border-dash-border bg-dash-card rounded-md border px-5 py-8 text-center">
            <p className="text-dash-muted-foreground text-sm">No open jobs yet.</p>
            {canUseJobs ? (
              <Link href="/portal/jobs/mine" className={`${PRIMARY} mt-4 inline-flex`}>
                Post a job
              </Link>
            ) : (
              <Link href="/portal/packs" className={`${PRIMARY} mt-4 inline-flex`}>
                View plans to post
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="border-dash-border text-dash-muted-foreground inline-flex rounded-sm border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
      {children}
    </span>
  );
}

function JobsPlanGate({ action }: { action: "post" | "apply" }) {
  return (
    <div className="border-dash-border bg-dash-card rounded-md border px-4 py-5 sm:px-5">
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">Nexis Desk</p>
      <h2 className="text-dash-foreground mt-1 text-base font-semibold">
        {action === "post" ? "Posting needs a paid plan" : "You can view this job · apply needs a paid plan"}
      </h2>
      <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">
        Free plan can read every listing.{" "}
        {action === "post" ? "Posting" : "Applying"} needs an active semester or full-year Nexis Desk plan.
      </p>
      <Link href="/portal/packs" className={`${PRIMARY} mt-4 inline-flex`}>
        View plans
      </Link>
    </div>
  );
}

/** Post and manage your own jobs + applications. */
export function MyJobsBoard({
  myJobs,
  myApplications,
  canUseJobs,
}: {
  myJobs: PortalJob[];
  myApplications: PortalJobApplication[];
  canUseJobs: boolean;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">Honic Nexis</p>
          <h1 className="text-dash-foreground mt-1 text-3xl font-semibold tracking-tight">Manage jobs</h1>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            {canUseJobs
              ? "Post work and track applications."
              : "Browse is free. Posting and applying need an active Nexis Desk plan."}
          </p>
        </div>
        <JobsTabs active="mine" />
      </header>

      <div className="text-dash-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span>
          <strong className="text-dash-foreground tabular-nums">{myJobs.length}</strong> posts
        </span>
        <span>
          <strong className="text-dash-foreground tabular-nums">{myApplications.length}</strong> applications
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <div className="space-y-6">
          <section className="border-dash-border bg-dash-card overflow-hidden rounded-md border">
            <div className="border-dash-border flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
              <h2 className="text-dash-foreground text-base font-semibold">Your posts</h2>
              <span className="text-dash-muted-foreground text-xs tabular-nums">{myJobs.length}</span>
            </div>
            {myJobs.length ? (
              <ul className="divide-dash-border divide-y">
                {myJobs.map((job) => (
                  <ManagedPostRow key={job.id} job={job} canManage={canUseJobs} />
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center sm:px-5">
                <p className="text-dash-muted-foreground text-sm">No posts yet. Use the form to create one.</p>
              </div>
            )}
          </section>

          <section className="border-dash-border bg-dash-card overflow-hidden rounded-md border">
            <div className="border-dash-border flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
              <h2 className="text-dash-foreground text-base font-semibold">Your applications</h2>
              <span className="text-dash-muted-foreground text-xs tabular-nums">{myApplications.length}</span>
            </div>
            {myApplications.length ? (
              <ul className="divide-dash-border divide-y">
                {myApplications.map((app) => (
                  <li key={app.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill>{app.status}</StatusPill>
                        {app.jobPublicId ? (
                          <span className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                            {jobRefLabel(app.jobPublicId)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-dash-muted-foreground line-clamp-2 text-sm">{app.message}</p>
                      <p className="text-dash-muted-foreground text-xs">
                        {formatDate(app.createdAt)}
                        {app.proposedTsh != null ? ` · proposed ${formatTsh(app.proposedTsh)}` : ""}
                      </p>
                    </div>
                    {app.jobPublicId ? (
                      <Link
                        href={`/portal/jobs/${app.jobPublicId}`}
                        className="border-dash-border text-dash-foreground hover:bg-dash-muted shrink-0 rounded-sm border px-3 py-1.5 text-sm font-medium"
                      >
                        Open
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center sm:px-5">
                <p className="text-dash-muted-foreground text-sm">
                  No applications yet.{" "}
                  <Link href="/portal/jobs" className="text-dash-accent font-semibold">
                    Browse My jobs
                  </Link>
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24">
          {canUseJobs ? (
            <PostJobForm compact />
          ) : (
            <JobsPlanGate action="post" />
          )}
        </aside>
      </div>
    </div>
  );
}

/** @deprecated use JobsBrowseBoard / MyJobsBoard */
export function JobsBoard(props: {
  openJobs: PortalJob[];
  myJobs: PortalJob[];
  myApplications: PortalJobApplication[];
}) {
  return <JobsBrowseBoard openJobs={props.openJobs} canUseJobs={false} />;
}

function ManagedPostRow({ job, canManage }: { job: PortalJob; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const canEdit = canManage && (job.status === "open" || job.status === "assigned");

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill>{job.status}</StatusPill>
            <span className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              {jobRefLabel(job.publicId)} · {job.categoryLabel}
            </span>
          </div>
          <p className="text-dash-foreground text-sm font-semibold leading-snug">{job.title}</p>
          <p className="text-dash-muted-foreground text-xs">
            {formatTsh(job.offerTsh)} · {job.priceMode === "negotiable" ? "Negotiable" : "Fixed"} ·{" "}
            {formatDate(job.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Link
            href={`/portal/jobs/${job.publicId}`}
            className="bg-dash-accent rounded-sm px-3 py-1.5 text-sm font-medium text-white"
          >
            Open
          </Link>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="border-dash-border text-dash-foreground hover:bg-dash-muted rounded-sm border px-3 py-1.5 text-sm font-medium"
            >
              {editing ? "Close" : "Edit"}
            </button>
          ) : null}
          {canManage ? <DeleteJobButton jobPublicId={job.publicId} redirectTo="/portal/jobs/mine" /> : null}
        </div>
      </div>
      {editing && canEdit ? (
        <div className="mt-4">
          <EditJobForm job={job} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </li>
  );
}

function OwnerJobTools({ job, canManage }: { job: PortalJob; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const canEdit = canManage && (job.status === "open" || job.status === "assigned");

  if (!canManage) {
    return (
      <JobsPlanGate action="post" />
    );
  }

  return (
    <div className="border-dash-border bg-dash-card space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-dash-foreground text-sm font-semibold">Your post</p>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="border-dash-border text-dash-foreground hover:bg-dash-muted rounded-sm border px-3 py-1.5 text-sm font-medium"
          >
            {editing ? "Cancel edit" : "Edit job"}
          </button>
        ) : null}
        <DeleteJobButton jobPublicId={job.publicId} redirectTo="/portal/jobs/mine" />
      </div>
      {editing && canEdit ? <EditJobForm job={job} onDone={() => setEditing(false)} /> : null}
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
      className="border-dash-border grid gap-3 rounded-md border p-3"
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
            priceMode: String(fd.get("priceMode") ?? "fixed"),
          });
          setStatus(res);
          if (res.ok) {
            onDone?.();
            router.refresh();
          }
        });
      }}
    >
      <Field label="Category">
        <select name="category" className={INPUT} defaultValue={job.category} required>
          {JOB_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Offering (TSh)">
        <input
          name="offerTsh"
          type="number"
          min={1000}
          step={500}
          required
          className={INPUT}
          defaultValue={job.offerTsh}
        />
      </Field>
      <Field label="Title">
        <input name="title" required minLength={8} maxLength={160} className={INPUT} defaultValue={job.title} />
      </Field>
      <Field label="Details">
        <textarea
          name="description"
          required
          minLength={20}
          maxLength={4000}
          rows={4}
          className={INPUT}
          defaultValue={job.description}
        />
      </Field>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="text-dash-muted-foreground mb-1 text-xs font-semibold uppercase">Price</legend>
        <label
          className={`border-dash-border flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            priceMode === "fixed" ? "border-dash-accent bg-dash-accent/5" : ""
          }`}
        >
          <input
            type="radio"
            name="priceMode"
            value="fixed"
            checked={priceMode === "fixed"}
            onChange={() => setPriceMode("fixed")}
            className="mt-1"
          />
          <span>
            <strong className="text-dash-foreground">Fixed</strong>
          </span>
        </label>
        <label
          className={`border-dash-border flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            priceMode === "negotiable" ? "border-dash-accent bg-dash-accent/5" : ""
          }`}
        >
          <input
            type="radio"
            name="priceMode"
            value="negotiable"
            checked={priceMode === "negotiable"}
            onChange={() => setPriceMode("negotiable")}
            className="mt-1"
          />
          <span>
            <strong className="text-dash-foreground">Negotiable</strong>
          </span>
        </label>
      </fieldset>
      <button type="submit" className={PRIMARY} disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
      {status ? <StatusText status={status} /> : null}
    </form>
  );
}

function DeleteJobButton({
  jobPublicId,
  redirectTo,
}: {
  jobPublicId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className="border-dash-border text-red-700 hover:bg-red-50 rounded-sm border px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
        onClick={() => {
          if (!window.confirm("Delete this job? Applications and messages will be removed.")) return;
          setStatus(null);
          startTransition(async () => {
            const res = await portalDeleteJobAction(jobPublicId);
            setStatus(res);
            if (res.ok) {
              if (redirectTo) router.push(redirectTo);
              else router.refresh();
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {status && !status.ok ? <span className="text-xs text-red-600 dark:text-red-300">{status.message}</span> : null}
    </span>
  );
}

function PostJobForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [priceMode, setPriceMode] = useState<"fixed" | "negotiable">("fixed");

  function submit(fd: FormData) {
    setStatus(null);
    startTransition(async () => {
      const res = await portalPostJobAction({
        category: String(fd.get("category") ?? ""),
        title: String(fd.get("title") ?? ""),
        description: String(fd.get("description") ?? ""),
        offerTsh: Number(fd.get("offerTsh")),
        priceMode: String(fd.get("priceMode") ?? "fixed"),
      });
      setStatus(res);
      if (res.ok) {
        (document.getElementById("post-job-form") as HTMLFormElement | null)?.reset();
        setPriceMode("fixed");
        router.refresh();
      }
    });
  }

  return (
    <section className="border-dash-border bg-dash-card rounded-md border p-4 sm:p-5">
      <h2 className="text-dash-foreground text-base font-semibold tracking-tight">Post a job</h2>
      <p className="text-dash-muted-foreground mt-0.5 text-xs">Anonymous · no real name shown</p>
      <form
        id="post-job-form"
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <Field label="Category">
          <select name="category" className={INPUT} defaultValue={JOB_CATEGORIES[0].id} required>
            {JOB_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Offering (TSh)">
          <input name="offerTsh" type="number" min={1000} step={500} required className={INPUT} placeholder="25000" />
        </Field>

        <Field label="Title">
          <input
            name="title"
            required
            minLength={8}
            maxLength={160}
            className={INPUT}
            placeholder="e.g. Draw block diagram for IoT monitoring"
          />
        </Field>

        <Field label="Details">
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={4000}
            rows={compact ? 4 : 5}
            className={INPUT}
            placeholder="What is needed, deadline, tools, and what you will supply."
          />
        </Field>

        <fieldset className="grid gap-2">
          <legend className="text-dash-muted-foreground mb-1 text-xs font-semibold uppercase">Price</legend>
          <label
            className={`border-dash-border flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              priceMode === "fixed" ? "border-dash-accent bg-dash-accent/5" : ""
            }`}
          >
            <input
              type="radio"
              name="priceMode"
              value="fixed"
              checked={priceMode === "fixed"}
              onChange={() => setPriceMode("fixed")}
              className="mt-1"
            />
            <span>
              <strong className="text-dash-foreground">Fixed</strong>
              <span className="text-dash-muted-foreground block text-xs">Listed amount</span>
            </span>
          </label>
          <label
            className={`border-dash-border flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              priceMode === "negotiable" ? "border-dash-accent bg-dash-accent/5" : ""
            }`}
          >
            <input
              type="radio"
              name="priceMode"
              value="negotiable"
              checked={priceMode === "negotiable"}
              onChange={() => setPriceMode("negotiable")}
              className="mt-1"
            />
            <span>
              <strong className="text-dash-foreground">Negotiable</strong>
              <span className="text-dash-muted-foreground block text-xs">Discuss in chat</span>
            </span>
          </label>
        </fieldset>

        <button type="submit" className={`${PRIMARY} w-full`} disabled={pending}>
          {pending ? "Posting…" : "Post job"}
        </button>
        {status ? <StatusText status={status} /> : null}
      </form>
    </section>
  );
}

function JobCard({ job, canApply }: { job: PortalJob; canApply: boolean }) {
  return (
    <li className="border-dash-border bg-dash-card rounded-md border px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
            {jobRefLabel(job.publicId)} · {job.categoryLabel}
          </p>
          <h3 className="text-dash-foreground mt-1 text-base font-semibold">{job.title}</h3>
          <p className="text-dash-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">{job.description}</p>
          <p className="text-dash-muted-foreground mt-2 text-xs">
            {job.posterLabel} · {formatDate(job.createdAt)} · {job.priceMode === "negotiable" ? "Negotiable" : "Fixed"}
            {!job.isMine && !canApply ? " · View only on free plan" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-dash-foreground text-lg font-semibold tabular-nums">{formatTsh(job.offerTsh)}</p>
          <Link href={`/portal/jobs/${job.publicId}`} className={`${PRIMARY} mt-3 inline-flex`}>
            {job.isMine ? "Manage" : canApply ? "View / apply" : "View"}
          </Link>
        </div>
      </div>
    </li>
  );
}

export function JobDetailPanel({
  job,
  applications,
  myApplication,
  messagesByApplicationPublicId,
  canUseJobs,
}: {
  job: PortalJob;
  applications: PortalJobApplication[];
  myApplication: PortalJobApplication | null;
  messagesByApplicationPublicId: Record<string, PortalJobMessage[]>;
  canUseJobs: boolean;
}) {
  const threadableApps = applications.filter((a) => a.status === "pending" || a.status === "accepted");
  const [activeAppId, setActiveAppId] = useState(
    () => threadableApps[0]?.publicId ?? myApplication?.publicId ?? null,
  );

  const activeApp =
    (job.isMine ? threadableApps.find((a) => a.publicId === activeAppId) : null) ??
    (!job.isMine && myApplication && (myApplication.status === "pending" || myApplication.status === "accepted")
      ? myApplication
      : null);

  const showThread = Boolean(activeApp);
  const showApplySlot = !job.isMine && job.status === "open" && !myApplication;
  const showAside = showApplySlot || showThread || (job.isMine && applications.length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/portal/jobs"
          className="text-dash-muted-foreground hover:text-dash-foreground rounded-sm px-3 py-1.5 text-sm font-medium"
        >
          ← My jobs
        </Link>
        <Link
          href="/portal/jobs/mine"
          className="bg-dash-accent rounded-sm px-3 py-1.5 text-sm font-medium text-white"
        >
          Manage jobs
        </Link>
      </div>

      <div className={`grid gap-6 ${showAside ? "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start" : ""}`}>
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
              {jobRefLabel(job.publicId)} · {job.categoryLabel} · {job.status}
            </p>
            <h1 className="text-dash-foreground text-2xl font-semibold tracking-tight">{job.title}</h1>
            <p className="text-dash-muted-foreground text-sm">
              {job.posterLabel} · {formatDate(job.createdAt)} · {formatTsh(job.offerTsh)} ·{" "}
              {job.priceMode === "negotiable" ? "Negotiable" : "Fixed offer"}
            </p>
            <p className="text-dash-foreground whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>
          </header>

          {job.isMine ? <OwnerJobTools job={job} canManage={canUseJobs} /> : null}

          {myApplication ? (
            <p className="text-dash-muted-foreground text-sm">
              Your application is <strong className="text-dash-foreground">{myApplication.status}</strong>
              {myApplication.proposedTsh != null ? ` · proposed ${formatTsh(myApplication.proposedTsh)}` : ""}.
            </p>
          ) : null}

          {job.isMine ? (
            <section className="space-y-3">
              <h2 className="text-dash-foreground text-lg font-semibold">Applications</h2>
              {applications.length ? (
                applications.map((app) => {
                  const canThread = app.status === "pending" || app.status === "accepted";
                  const selected = canThread && app.publicId === activeAppId;
                  return (
                    <div
                      key={app.id}
                      className={selected ? "ring-dash-accent/40 rounded-md ring-2 ring-offset-2 ring-offset-transparent" : ""}
                    >
                      <ApplicationRow
                        app={app}
                        canAccept={canUseJobs && job.status === "open" && app.status === "pending"}
                        onOpenThread={
                          canThread
                            ? () => setActiveAppId(app.publicId)
                            : undefined
                        }
                        threadSelected={selected}
                      />
                    </div>
                  );
                })
              ) : (
                <p className="text-dash-muted-foreground text-sm">No applications yet.</p>
              )}
            </section>
          ) : null}

          {showApplySlot ? (
            <div className="lg:hidden">
              {canUseJobs ? <ApplyForm job={job} /> : <JobsPlanGate action="apply" />}
            </div>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24">
          {showApplySlot ? (
            <div className="hidden lg:block">
              {canUseJobs ? <ApplyForm job={job} /> : <JobsPlanGate action="apply" />}
            </div>
          ) : null}
          {activeApp ? (
            <MessageThread
              applicationPublicId={activeApp.publicId}
              messages={messagesByApplicationPublicId[activeApp.publicId] ?? []}
              threadFor={job.isMine ? activeApp.applicantLabel : undefined}
              canSend={canUseJobs}
            />
          ) : job.isMine && applications.length ? (
            <div className="border-dash-border bg-dash-card rounded-md border px-4 py-8 text-center">
              <p className="text-dash-muted-foreground text-sm">Select an application to open its chat.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ApplyForm({ job }: { job: PortalJob }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  return (
    <form
      className="border-dash-border bg-dash-card grid gap-3 rounded-md border p-4"
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
      <h2 className="text-dash-foreground text-base font-semibold">Apply</h2>
      <Field label="Note to poster">
        <textarea name="message" required minLength={10} rows={3} className={INPUT} placeholder="What you can deliver and when." />
      </Field>
      {job.priceMode === "negotiable" ? (
        <Field label="Proposed amount (TSh, optional)">
          <input name="proposedTsh" type="number" min={1000} step={500} className={INPUT} placeholder={String(job.offerTsh)} />
        </Field>
      ) : null}
      <button type="submit" className={PRIMARY} disabled={pending}>
        {pending ? "Sending…" : "Send interest"}
      </button>
      {status ? <StatusText status={status} /> : null}
    </form>
  );
}

function ApplicationRow({
  app,
  canAccept,
  onOpenThread,
  threadSelected,
}: {
  app: PortalJobApplication;
  canAccept: boolean;
  onOpenThread?: () => void;
  threadSelected?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  return (
    <article className="border-dash-border bg-dash-card rounded-md border px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-dash-foreground text-sm font-semibold">
          {app.applicantLabel} · {app.status}
        </p>
        {onOpenThread ? (
          <button
            type="button"
            onClick={onOpenThread}
            className={`rounded-sm px-2.5 py-1 text-xs font-semibold ${
              threadSelected
                ? "bg-dash-accent text-white"
                : "text-dash-accent hover:bg-dash-muted"
            }`}
          >
            {threadSelected ? "Chatting" : "Open chat"}
          </button>
        ) : null}
      </div>
      <p className="text-dash-muted-foreground mt-1 text-sm">{app.message}</p>
      <p className="text-dash-muted-foreground mt-1 text-xs">
        {formatDateTime(app.createdAt)}
        {app.proposedTsh != null ? ` · proposed ${formatTsh(app.proposedTsh)}` : ""}
      </p>
      {canAccept ? (
        <button
          type="button"
          className={`${PRIMARY} mt-3`}
          disabled={pending}
          onClick={() => {
            setStatus(null);
            startTransition(async () => {
              const res = await portalAcceptJobApplicationAction(app.publicId);
              setStatus(res);
              if (res.ok) router.refresh();
            });
          }}
        >
          {pending ? "Selecting…" : "Select this helper"}
        </button>
      ) : null}
      {status ? <StatusText status={status} /> : null}
    </article>
  );
}

function MessageThread({
  applicationPublicId,
  messages,
  threadFor,
  canSend,
}: {
  applicationPublicId: string;
  messages: PortalJobMessage[];
  threadFor?: string;
  canSend: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft("");
  }, [applicationPublicId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, applicationPublicId]);

  function send() {
    if (!canSend) return;
    const body = draft.trim();
    if (!body || pending) return;
    setStatus(null);
    startTransition(async () => {
      const res = await portalJobMessageAction(applicationPublicId, body);
      setStatus(res);
      if (res.ok) {
        setDraft("");
        router.refresh();
      }
    });
  }

  return (
    <section className="border-dash-border bg-dash-card flex h-[min(32rem,75vh)] flex-col overflow-hidden rounded-md border lg:h-[min(36rem,calc(100vh-8rem))]">
      <header className="border-dash-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-dash-foreground text-sm font-semibold">
            {threadFor ? `Chat · ${threadFor}` : "Messages"}
          </h2>
          <p className="text-dash-muted-foreground text-[11px]">
            {canSend ? "Anonymous chat · no real names" : "View only · messaging locked on free plan"}
          </p>
        </div>
        <span className="text-dash-muted-foreground text-[11px] tabular-nums">{messages.length}</span>
      </header>

      <div ref={listRef} className="bg-dash-muted/25 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
        {!messages.length ? (
          <div className="flex h-full min-h-[8rem] items-center justify-center">
            <p className="text-dash-muted-foreground text-center text-sm">
              {canSend ? "No messages yet. Say hello below." : "No messages yet. Upgrade to send messages."}
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-md px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[75%] ${
                  m.isMine
                    ? "bg-dash-accent rounded-br-md text-white"
                    : "border-dash-border bg-dash-card text-dash-foreground rounded-bl-md border"
                }`}
              >
                <p className={`text-[10px] font-semibold tracking-wide uppercase ${m.isMine ? "text-white/75" : "text-dash-muted-foreground"}`}>
                  {m.isMine ? "You" : m.senderLabel}
                </p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                <p className={`mt-1.5 text-[10px] tabular-nums ${m.isMine ? "text-white/65" : "text-dash-muted-foreground"}`}>
                  {formatDateTime(m.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form
        className="border-dash-border bg-dash-card border-t px-3 py-3 sm:px-4"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {!canSend ? (
          <div className="space-y-2">
            <div className="border-dash-border bg-dash-muted/40 flex items-end gap-2 rounded-md border px-2 py-2 opacity-60">
              <textarea
                name="body"
                value=""
                rows={1}
                disabled
                readOnly
                placeholder="Messaging disabled on free plan"
                className="text-dash-muted-foreground max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
              />
              <button
                type="button"
                disabled
                aria-label="Send message disabled"
                className="bg-dash-accent inline-flex h-10 shrink-0 cursor-not-allowed items-center gap-1.5 rounded-md px-3.5 text-sm font-semibold text-white opacity-40"
              >
                Send
              </button>
            </div>
            <Link href="/portal/packs" className="text-dash-accent text-xs font-semibold">
              View plans to unlock messaging →
            </Link>
          </div>
        ) : (
          <>
            <div className="border-dash-border bg-dash-canvas flex items-end gap-2 rounded-md border px-2 py-2">
              <textarea
                name="body"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                maxLength={2000}
                required
                placeholder="Type a message…"
                className="text-dash-foreground placeholder:text-dash-muted-foreground max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                aria-label="Send message"
                className="bg-dash-accent inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-sm font-semibold text-white transition disabled:opacity-40"
              >
                {pending ? (
                  "…"
                ) : (
                  <>
                    Send
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </>
                )}
              </button>
            </div>
            {status && !status.ok ? (
              <p className="mt-2 text-xs text-red-600 dark:text-red-300">{status.message}</p>
            ) : null}
          </>
        )}
      </form>
    </section>
  );
}
