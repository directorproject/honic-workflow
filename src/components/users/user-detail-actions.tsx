"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  confirmStudentEmailAction,
  grantTitleChangeCreditAction,
  releaseStudentTitleAction,
  removeStudentAccountAction,
  sendStudentPasswordResetAction,
  setStudentSignInBlockedAction,
  unlinkStudentProjectAction,
} from "@/app/users/actions";

const SOFT = "border-dash-border bg-dash-muted hover:bg-dash-border rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50";
const WARN = "rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300";
const DANGER = "rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300";

export function UserDetailActions({
  publicId,
  email,
  name,
  staff,
  blocked,
  emailConfirmed,
  hasProfile,
  hasProject,
  hasTitle,
}: {
  /** Opaque portal account public id (never auth.users UUID). */
  publicId: string;
  email: string;
  name: string | null;
  staff: boolean;
  blocked: boolean;
  emailConfirmed: boolean;
  hasProfile: boolean;
  hasProject: boolean;
  hasTitle: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const label = name ?? (email || "this account");

  function run(action: () => Promise<void>, okMessage: string, leave = false) {
    setStatus(null);
    startTransition(async () => {
      try {
        await action();
        if (leave) {
          router.push("/users");
          return;
        }
        setStatus({ type: "ok", message: okMessage });
        router.refresh();
      } catch (err) {
        setStatus({ type: "error", message: err instanceof Error ? err.message : "Action failed." });
      }
    });
  }

  if (staff) {
    return <p className="text-dash-muted-foreground text-sm">This is a staff account. It is not changed from this page.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || !email} className={SOFT} onClick={() => run(() => sendStudentPasswordResetAction(publicId), `Reset link sent to ${email}.`)}>
          Reset password
        </button>
        <button
          type="button"
          disabled={pending}
          className={WARN}
          onClick={() => {
            const next = !blocked;
            if (!window.confirm(next ? `Block ${label} from signing in?` : `Let ${label} sign in again?`)) return;
            run(() => setStudentSignInBlockedAction(publicId, next), next ? "Sign-in blocked." : "Sign-in restored.");
          }}
        >
          {blocked ? "Unblock sign-in" : "Block sign-in"}
        </button>
        {emailConfirmed ? null : (
          <button
            type="button"
            disabled={pending}
            className={SOFT}
            onClick={() => {
              if (!window.confirm(`Mark ${label}'s email as confirmed?`)) return;
              run(() => confirmStudentEmailAction(publicId), "Email confirmed.");
            }}
          >
            Confirm email
          </button>
        )}
        {hasProfile ? (
          <button
            type="button"
            disabled={pending}
            className={SOFT}
            onClick={() => {
              if (!window.confirm(`Give ${label} one free title change?`)) return;
              run(() => grantTitleChangeCreditAction(publicId), "One title change added.");
            }}
          >
            Give title change
          </button>
        ) : null}
        {hasTitle ? (
          <button
            type="button"
            disabled={pending}
            className={WARN}
            onClick={() => {
              if (!window.confirm(`Release ${label}'s title back to the list? The account stays.`)) return;
              run(() => releaseStudentTitleAction(publicId), "Title released.");
            }}
          >
            Release title
          </button>
        ) : null}
        {hasProject ? (
          <button
            type="button"
            disabled={pending}
            className={SOFT}
            onClick={() => {
              if (!window.confirm(`Unlink ${label} from this project? The account stays.`)) return;
              run(() => unlinkStudentProjectAction(publicId), "Project unlinked.");
            }}
          >
            Unlink project
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className={DANGER}
          onClick={() => {
            if (!window.confirm(`Remove ${label}? They cannot sign in again, and their title is released.`)) return;
            run(() => removeStudentAccountAction(publicId), "Account removed.", true);
          }}
        >
          Remove account
        </button>
      </div>
      {status ? (
        <p role="status" className={`mt-3 text-sm ${status.type === "ok" ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
