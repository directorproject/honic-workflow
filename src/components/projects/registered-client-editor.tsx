"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import type { UpdateRegisteredClientState } from "@/app/projects/[id]/registered-client-actions";
import { updateRegisteredClientForProjectAction } from "@/app/projects/[id]/registered-client-actions";

export function RegisteredClientEditor({
  projectId,
  initialName,
  initialShareSubdomain,
}: {
  projectId: string;
  initialName: string;
  initialShareSubdomain: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const bound = updateRegisteredClientForProjectAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState<UpdateRegisteredClientState, FormData>(bound, null);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-dash-muted-foreground text-sm">
          <span className="text-dash-foreground font-medium">Registered client:</span> {initialName}
          {initialShareSubdomain ? (
            <span className="text-dash-muted-foreground ml-1 font-mono text-xs">· {initialShareSubdomain}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-dash-border bg-dash-muted/50 text-dash-foreground hover:bg-dash-muted rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors"
        >
          Edit
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm dark:bg-black/55"
            aria-label="Close dialog"
            onClick={() => !pending && setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="registered-client-edit-title"
            className="border-dash-border bg-dash-card text-dash-foreground relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="registered-client-edit-title" className="text-lg font-semibold tracking-tight">
              Edit registered client
            </h2>
            <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">
              Updates the client record for this project (and any other projects using the same client). Share links use
              the name or optional subdomain label.
            </p>

            <form action={formAction} className="mt-5 space-y-4">
              <div>
                <label htmlFor="rc-name" className="text-dash-foreground mb-1 block text-xs font-semibold">
                  Client name
                </label>
                <input
                  id="rc-name"
                  name="name"
                  type="text"
                  required
                  defaultValue={initialName}
                  disabled={pending}
                  className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                />
              </div>
              <div>
                <label htmlFor="rc-sub" className="text-dash-foreground mb-1 block text-xs font-semibold">
                  Share subdomain label <span className="text-dash-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="rc-sub"
                  name="share_subdomain"
                  type="text"
                  defaultValue={initialShareSubdomain ?? ""}
                  disabled={pending}
                  placeholder="e.g. acme-api"
                  className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent w-full rounded-xl border px-3 py-2 font-mono text-sm outline-none focus:ring-2"
                />
                <p className="text-dash-muted-foreground mt-1 text-[11px]">
                  Lowercase letters, numbers, hyphens; leave empty to derive from the client name for share URLs.
                </p>
              </div>

              {state && !state.ok ? (
                <p className="text-red-600 dark:text-red-300 text-sm" role="alert">
                  {state.message}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="border-dash-border text-dash-foreground hover:bg-dash-muted/60 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
