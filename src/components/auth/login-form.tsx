"use client";

import { useActionState } from "react";

import { signInAction, type SignInState } from "@/app/login/actions";
import { Spinner } from "@/components/ui/spinner";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(signInAction, null);

  return (
    <form action={formAction} className="space-y-4" aria-busy={isPending}>
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label htmlFor="username" className="text-dash-muted-foreground mb-1 block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          disabled={isPending}
          autoComplete="username"
          className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:cursor-wait disabled:opacity-60"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-dash-muted-foreground mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          disabled={isPending}
          autoComplete="current-password"
          className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 disabled:cursor-wait disabled:opacity-60"
        />
      </div>
      {state?.ok === false ? (
        <p className="text-sm text-red-600 dark:text-red-300" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? <Spinner /> : null}
        {isPending ? "Signing in…" : "Sign in"}
      </button>
      {isPending ? (
        <p className="text-dash-muted-foreground text-center text-xs" role="status">
          Checking credentials…
        </p>
      ) : null}
    </form>
  );
}
