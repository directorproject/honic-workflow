"use client";

import { useActionState, useState } from "react";

import { supervisorAuthFormAction, type SupervisorAuthFormState } from "@/app/supervisor/auth-actions";

const INPUT =
  "border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";
const BTN =
  "bg-dash-accent inline-flex w-full cursor-pointer items-center justify-center rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-60";

export function SupervisorAuthForm({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [state, action, pending] = useActionState<SupervisorAuthFormState, FormData>(supervisorAuthFormAction, null);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === "signin" ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground"}`}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === "signup" ? "bg-dash-accent text-white" : "bg-dash-muted text-dash-muted-foreground"}`}
          onClick={() => setMode("signup")}
        >
          Create account
        </button>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="mode" value={mode} />
        {mode === "signup" ? (
          <label className="block">
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Full name</span>
            <input name="fullName" required maxLength={120} className={INPUT} autoComplete="name" />
          </label>
        ) : null}
        <label className="block">
          <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Email</span>
          <input name="email" type="email" required maxLength={254} className={INPUT} autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Password</span>
          <input name="password" type="password" required minLength={8} className={INPUT} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </label>
        {mode === "signup" ? (
          <label className="block">
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Confirm password</span>
            <input name="password2" type="password" required minLength={8} className={INPUT} autoComplete="new-password" />
          </label>
        ) : null}
        {state && !state.ok ? <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{state.message}</p> : null}
        {state?.ok && state.message ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{state.message}</p> : null}
        <button type="submit" disabled={pending} className={BTN}>
          {pending ? "Please wait…" : mode === "signup" ? "Create supervisor account" : "Sign in"}
        </button>
      </form>
      <p className="text-dash-muted-foreground mt-4 text-xs">
        Use the same email the student saved under Team & supervisor. You will see every project that lists that email.
      </p>
    </div>
  );
}
