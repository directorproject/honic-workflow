"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import type { CreateShareLinkState } from "@/app/projects/[id]/share-actions";
import { createClientShareLinkAction } from "@/app/projects/[id]/share-actions";
import type { ProjectShareLinkRow } from "@/lib/project-share";
import { buildShareProjectRelativePath } from "@/lib/share-link-origin";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
      className="border-dash-border bg-dash-muted/40 text-dash-foreground hover:bg-dash-muted/60 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
    >
      {done ? "Copied" : "Copy link"}
    </button>
  );
}

export function ProjectShareLinkPanel({
  projectId,
  existingLinks,
  shareLinkOrigin,
  shareClientSlug,
}: {
  projectId: string;
  existingLinks: ProjectShareLinkRow[];
  /** Per-client host or fixed `NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN` when set. */
  shareLinkOrigin: string;
  /** Registered-client segment in `/share/{slug}/{token}`. */
  shareClientSlug: string;
}) {
  const router = useRouter();
  const bound = createClientShareLinkAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState<CreateShareLinkState, FormData>(bound, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const origin = shareLinkOrigin.replace(/\/$/, "");
  const linkRows = existingLinks.map((row) => ({
    ...row,
    fullUrl: origin
      ? `${origin}${buildShareProjectRelativePath(shareClientSlug, row.token)}`
      : buildShareProjectRelativePath(shareClientSlug, row.token),
  }));

  const hasLink = linkRows.length > 0;

  return (
    <section className="border-dash-border bg-dash-card mb-8 rounded-2xl border p-5 shadow-sm sm:p-6">
      <h2 className="text-dash-foreground mb-1 text-base font-semibold">Client share link</h2>
      <p className="text-dash-muted-foreground mb-4 text-sm leading-relaxed">
        {hasLink
          ? "This project has one permanent share URL. Anyone with the link can open the read-only client view (no login). Do not share it outside your client unless you intend to."
          : "Create the single share URL for this project. It uses "}
        {!hasLink ? (
          <>
            <span className="text-dash-foreground font-mono text-xs">/share/&lt;client&gt;/&lt;token&gt;</span> with a slug from the
            registered client (or <span className="font-mono text-xs">share_subdomain</span> when set). If{" "}
            <span className="font-mono text-xs">NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN</span> is set (e.g.{" "}
            <span className="font-mono text-xs">https://share.example.com</span>), that host is used. Recipients only see
            this project summary, the activity checklist, and files they can preview or download — not the rest of Honic.
          </>
        ) : null}
      </p>

      {!hasLink ? (
        <form action={formAction} className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-dash-accent hover:bg-dash-accent-dim rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 transition-colors disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create share link"}
          </button>
        </form>
      ) : null}

      {state && !state.ok ? (
        <p className="text-red-600 dark:text-red-300 mb-4 text-sm" role="alert">
          {state.message}
        </p>
      ) : null}

      {state?.ok ? (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            state.alreadyExisted
              ? "border-sky-500/30 bg-sky-500/10 text-sky-950 dark:text-sky-100"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
          }`}
        >
          <p className="font-medium">
            {state.alreadyExisted ? "This project already has a share link — same URL as below:" : "Share link ready — send this URL to your client:"}
          </p>
          <p className="text-dash-foreground mt-2 break-all font-mono text-xs">{state.url}</p>
          <div className="mt-3">
            <CopyButton text={state.url} />
          </div>
        </div>
      ) : null}

      {hasLink ? (
        <div>
          <h3 className="text-dash-foreground mb-2 text-sm font-semibold">Your share link</h3>
          <ul className="divide-dash-border divide-y rounded-xl border">
            {linkRows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-dash-foreground break-all font-mono text-xs">{row.fullUrl}</p>
                  <p className="text-dash-muted-foreground mt-1 text-[11px]">
                    Created {new Date(row.created_at).toLocaleString()}
                    {row.expires_at ? ` · Expires ${new Date(row.expires_at).toLocaleString()}` : ""}
                    {row.label ? ` · ${row.label}` : ""}
                  </p>
                </div>
                <CopyButton text={row.fullUrl} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-dash-muted-foreground text-xs">No share link yet — use the button above once.</p>
      )}
    </section>
  );
}
