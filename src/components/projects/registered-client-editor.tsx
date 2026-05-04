"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import type { UpdateRegisteredClientState } from "@/app/projects/[id]/registered-client-actions";
import { updateRegisteredClientForProjectAction } from "@/app/projects/[id]/registered-client-actions";
import { PROJECT_TYPES } from "@/lib/project-types";

export function RegisteredClientEditor({
  projectId,
  initialProjectTitle,
  initialProjectType,
  initialPriority,
  initialDescription,
  initialName,
  initialShareSubdomain,
  initialPhone,
}: {
  projectId: string;
  initialProjectTitle: string;
  initialProjectType: string;
  initialPriority: string;
  initialDescription: string | null;
  initialName: string;
  initialShareSubdomain: string | null;
  initialPhone: string | null;
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
          {initialPhone ? (
            <span className="text-dash-muted-foreground ml-1">
              ·{" "}
              <a
                href={`tel:${initialPhone.replace(/\s/g, "")}`}
                className="text-dash-accent font-semibold underline-offset-2 hover:underline"
              >
                {initialPhone}
              </a>
            </span>
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
            className="border-dash-border bg-dash-card text-dash-foreground relative z-10 max-h-[min(90vh,720px)] w-full max-w-xl overflow-y-auto rounded-2xl border p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="registered-client-edit-title" className="text-lg font-semibold tracking-tight">
              Edit project &amp; client
            </h2>
            <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">
              Updates this project&apos;s title, type, priority, and description, plus the registered client (shared with
              any other projects using that client). Share links use the client name or optional subdomain.
            </p>

            <form action={formAction} className="mt-5 space-y-5">
              <div className="border-dash-border space-y-4 border-b border-dashed pb-5">
                <p className="text-dash-foreground text-xs font-semibold uppercase tracking-wide">Project</p>
                <div>
                  <label htmlFor="edit-project-title" className="text-dash-foreground mb-1 block text-xs font-semibold">
                    Project title <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    id="edit-project-title"
                    name="project_title"
                    type="text"
                    required
                    defaultValue={initialProjectTitle}
                    disabled={pending}
                    className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="edit-project-type" className="text-dash-foreground mb-1 block text-xs font-semibold">
                      Type <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <select
                      id="edit-project-type"
                      name="project_type"
                      required
                      defaultValue={
                        PROJECT_TYPES.some((p) => p.value === initialProjectType)
                          ? initialProjectType
                          : "product_prototype"
                      }
                      disabled={pending}
                      className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                    >
                      {PROJECT_TYPES.map((pt) => (
                        <option key={pt.value} value={pt.value}>
                          {pt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit-priority" className="text-dash-foreground mb-1 block text-xs font-semibold">
                      Priority <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <select
                      id="edit-priority"
                      name="priority"
                      required
                      defaultValue={["low", "medium", "high", "critical"].includes(initialPriority) ? initialPriority : "medium"}
                      disabled={pending}
                      className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="edit-description" className="text-dash-foreground mb-1 block text-xs font-semibold">
                    Description <span className="text-dash-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="edit-description"
                    name="description"
                    rows={3}
                    defaultValue={initialDescription ?? ""}
                    disabled={pending}
                    placeholder="Goals, scope, notes…"
                    className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent w-full resize-y rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-dash-foreground text-xs font-semibold uppercase tracking-wide">Registered client</p>
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
                <label htmlFor="rc-phone" className="text-dash-foreground mb-1 block text-xs font-semibold">
                  Phone <span className="text-dash-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="rc-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={initialPhone ?? ""}
                  disabled={pending}
                  placeholder="e.g. +1 234 567 8900"
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
