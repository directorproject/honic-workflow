"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  portalForgotPasswordAction,
  portalSignInAction,
  portalSignUpAction,
  type PortalResult,
} from "@/app/portal/actions";
import { Card, Field, INPUT, PRIMARY, StatusText } from "@/components/portal/portal-ui";

type Mode = "signin" | "signup" | "forgot";

export function PortalAuth({ initialStatus }: { initialStatus?: PortalResult | null }) {
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
