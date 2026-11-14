"use client";

import { useActionState, useState, type ReactNode } from "react";

import {
  portalAuthFormAction,
  portalGoogleSignInAction,
  type PortalAuthFormState,
  type PortalResult,
} from "@/app/portal/auth-actions";
import { Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Spinner } from "@/components/ui/spinner";

export type PortalAuthMode = "signin" | "signup" | "forgot";

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

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 11 7-.5 1.2-1.2 2.3-2.1 3.3M6.1 6.1C4.2 7.4 2.7 9.1 2 12c1.7 3.9 6 7 10 7 1.4 0 2.7-.3 3.9-.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function GoogleButton() {
  const [msg, setMsg] = useState<PortalResult | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        className={`${SECONDARY} w-full`}
        onClick={() => {
          setMsg(null);
          setPending(true);
          void portalGoogleSignInAction()
            .then((res) => {
              if (!res.ok) setMsg(res);
            })
            .catch(() => {
              setMsg({ ok: false, message: "Google sign-in failed. Try email instead." });
            })
            .finally(() => setPending(false));
        }}
      >
        {pending ? <Spinner /> : <GoogleIcon />}
        {pending ? "Connecting…" : "Continue with Google"}
      </button>
      <StatusText status={msg} />
      <div className="text-dash-muted-foreground my-4 flex items-center gap-3 text-xs">
        <span className="bg-dash-border h-px flex-1" />
        or with email
        <span className="bg-dash-border h-px flex-1" />
      </div>
    </>
  );
}

function tabClass(active: boolean) {
  return active
    ? "bg-dash-card text-dash-foreground block cursor-pointer rounded-lg px-3 py-2.5 text-center text-sm font-semibold shadow-sm"
    : "text-dash-muted-foreground hover:text-dash-foreground block cursor-pointer rounded-lg px-3 py-2.5 text-center text-sm font-semibold";
}

function ModeTab({ mode, active, children }: { mode: PortalAuthMode; active: boolean; children: ReactNode }) {
  // GET form forces a full document navigation (works even when client soft-nav/hydration is broken).
  return (
    <form action="/portal" method="get" className="contents">
      <input type="hidden" name="auth" value={mode} />
      <button type="submit" role="tab" aria-selected={active} className={tabClass(active)}>
        {children}
      </button>
    </form>
  );
}

export function PortalAuth({
  initialStatus,
  googleEnabled = false,
  initialMode = "signup",
}: {
  initialStatus?: PortalResult | null;
  googleEnabled?: boolean;
  initialMode?: PortalAuthMode;
}) {
  const mode = initialMode;
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState<PortalAuthFormState, FormData>(
    portalAuthFormAction,
    initialStatus ?? null,
  );

  const titles: Record<PortalAuthMode, [string, string]> = {
    signin: ["Sign in", "Welcome back. Use your student email and password."],
    signup: ["Create account", "Register with your own email. Confirm from your inbox, then sign in."],
    forgot: ["Reset password", "We email a secure link to set a new password."],
  };

  const submitLabel =
    mode === "signin" ? "Sign in securely" : mode === "signup" ? "Create student account" : "Send reset link";
  const pendingLabel = mode === "signin" ? "Signing in…" : mode === "signup" ? "Creating account…" : "Sending link…";

  return (
    <div className="relative z-10 mx-auto w-full max-w-md space-y-6">
      <div className="absolute top-0 right-0 sm:-right-2 sm:-top-2">
        <ThemeToggle />
      </div>
      <div className="text-center">
        <div className="bg-dash-card border-dash-border mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border p-1">
          {/* Plain img avoids next/image hydration mismatches across LAN vs localhost. */}
          <img src="/logo.jpg" alt="Honic" width={48} height={48} className="h-full w-full object-contain" />
        </div>
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">Honic Company Limited</p>
        <h1 className="text-dash-foreground mt-1 text-2xl font-semibold tracking-tight">Honic Nexis</h1>
        <p className="text-dash-muted-foreground mt-2 text-sm leading-relaxed">
          Titles, ownership claims, and your project workspace. Staff use inova separately.
        </p>
      </div>

      <section className="border-dash-border bg-dash-card rounded-2xl border p-5 shadow-sm sm:p-6">
        {mode !== "forgot" ? (
          <div className="bg-dash-muted/40 mb-5 grid grid-cols-2 gap-1 rounded-xl p-1" role="tablist" aria-label="Account">
            <ModeTab mode="signup" active={mode === "signup"}>
              Create account
            </ModeTab>
            <ModeTab mode="signin" active={mode === "signin"}>
              Sign in
            </ModeTab>
          </div>
        ) : null}

        <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">{titles[mode][0]}</h2>
        <p className="text-dash-muted-foreground mt-1 mb-4 text-sm">{titles[mode][1]}</p>

        {googleEnabled && mode !== "forgot" ? <GoogleButton /> : null}

        <form action={formAction} className="grid gap-3" autoComplete="on" aria-busy={pending}>
          <input type="hidden" name="mode" value={mode} />
          <Field label="Student email">
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              inputMode="email"
              className={INPUT}
              placeholder="you@school.edu"
            />
          </Field>

          {mode !== "forgot" ? (
            <Field label="Password">
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className={`${INPUT} pr-11`}
                />
                <button
                  type="button"
                  className="text-dash-muted-foreground hover:text-dash-foreground absolute top-1/2 right-2 z-10 -translate-y-1/2 cursor-pointer rounded-lg p-2"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </Field>
          ) : null}

          {mode === "signup" ? (
            <Field label="Confirm password">
              <input
                name="password2"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                className={INPUT}
              />
            </Field>
          ) : null}

          <StatusText status={state} />
          <button type="submit" disabled={pending} aria-busy={pending} className={`${PRIMARY} w-full`}>
            {pending ? <Spinner /> : null}
            {pending ? pendingLabel : submitLabel}
          </button>
          {pending ? (
            <p className="text-dash-muted-foreground text-center text-xs" role="status">
              Checking your account…
            </p>
          ) : null}
        </form>

        <div className="border-dash-border mt-5 space-y-2 border-t pt-4 text-sm">
          {mode === "signup" ? (
            <p className="text-dash-muted-foreground">
              Already registered?{" "}
              <a href="/portal?auth=signin" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
                Sign in
              </a>
            </p>
          ) : null}
          {mode === "signin" ? (
            <>
              <p className="text-dash-muted-foreground">
                New student?{" "}
                <a href="/portal?auth=signup" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
                  Create an account
                </a>
              </p>
              <p className="text-dash-muted-foreground">
                <a href="/portal?auth=forgot" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
                  Forgot password?
                </a>
              </p>
            </>
          ) : null}
          {mode === "forgot" ? (
            <p className="text-dash-muted-foreground">
              Remembered it?{" "}
              <a href="/portal?auth=signin" className="text-dash-accent font-semibold underline-offset-2 hover:underline">
                Back to sign in
              </a>
            </p>
          ) : null}
        </div>
      </section>

      <p className="text-dash-muted-foreground text-center text-xs leading-relaxed">
        Staff accounts belong on{" "}
        <a className="text-dash-accent font-semibold" href="https://inova.honiccompany.com/login">
          inova.honiccompany.com
        </a>
        , not this student portal.
      </p>
    </div>
  );
}
