"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  portalForgotPasswordAction,
  portalGoogleSignInAction,
  portalSignInAction,
  portalSignUpAction,
  type PortalResult,
} from "@/app/portal/actions";
import { Card, Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";

type Mode = "signin" | "signup" | "forgot";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function PortalAuth({
  initialStatus,
  googleEnabled = false,
}: {
  initialStatus?: PortalResult | null;
  googleEnabled?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [status, setStatus] = useState<PortalResult | null>(initialStatus ?? null);
  const [pending, startTransition] = useTransition();

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    if (mode === "signup" && password !== String(fd.get("password2") ?? "")) {
      setStatus({ ok: false, message: "The two passwords do not match." });
      return;
    }
    setStatus(null);
    startTransition(async () => {
      const res =
        mode === "signin"
          ? await portalSignInAction(email, password)
          : mode === "signup"
            ? await portalSignUpAction(email, password)
            : await portalForgotPasswordAction(email);
      setStatus(res);
      if (res.ok && !res.message) router.refresh();
    });
  }

  const titles: Record<Mode, [string, string]> = {
    signin: ["Sign in", "Students: sign in to choose your project title or follow your project."],
    signup: ["Create your student account", "Use your own email. You will confirm it from your inbox."],
    forgot: ["Forgot password", "We will email you a link to set a new password."],
  };

  return (
    <Card title={titles[mode][0]} subtitle={titles[mode][1]}>
      {googleEnabled && mode !== "forgot" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setStatus(null);
              startTransition(async () => {
                const res = await portalGoogleSignInAction();
                if (!res.ok) setStatus(res);
              });
            }}
            className={`${SECONDARY} flex w-full items-center justify-center gap-2`}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <div className="text-dash-muted-foreground my-4 flex items-center gap-3 text-xs">
            <span className="bg-dash-border h-px flex-1" />
            or with email
            <span className="bg-dash-border h-px flex-1" />
          </div>
        </>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
        className="grid gap-3"
      >
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className={INPUT} />
        </Field>
        {mode !== "forgot" ? (
          <Field label="Password">
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={INPUT}
            />
          </Field>
        ) : null}
        {mode === "signup" ? (
          <Field label="Confirm password">
            <input name="password2" type="password" required minLength={8} autoComplete="new-password" className={INPUT} />
          </Field>
        ) : null}
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send link"}
        </button>
        <StatusText status={status} />
      </form>
      <div className="text-dash-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {mode !== "signin" ? (
          <button type="button" className="text-dash-accent font-semibold" onClick={() => (setMode("signin"), setStatus(null))}>
            I have an account
          </button>
        ) : null}
        {mode !== "signup" ? (
          <button type="button" className="text-dash-accent font-semibold" onClick={() => (setMode("signup"), setStatus(null))}>
            Create an account
          </button>
        ) : null}
        {mode === "signin" ? (
          <button type="button" className="text-dash-accent font-semibold" onClick={() => (setMode("forgot"), setStatus(null))}>
            Forgot password?
          </button>
        ) : null}
      </div>
    </Card>
  );
}
