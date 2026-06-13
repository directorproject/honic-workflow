"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, type SignInState } from "@/app/login/actions";
import { AUTH_OPERATOR_DEFAULT_PASSWORD, AUTH_OPERATOR_USERNAME } from "@/lib/auth-credentials";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-dash-accent text-slate-950 hover:bg-dash-accent-dim w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState<SignInState, FormData>(signInAction, null);

  return (
    <form action={formAction} className="space-y-4">
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
          autoComplete="username"
          defaultValue={AUTH_OPERATOR_USERNAME}
          className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
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
          autoComplete="current-password"
          defaultValue={AUTH_OPERATOR_DEFAULT_PASSWORD}
          className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
        />
      </div>
      {state?.ok === false ? (
        <p className="text-red-600 dark:text-red-300 text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
