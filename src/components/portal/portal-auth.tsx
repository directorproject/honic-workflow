"use client";

import Image from "next/image";
import { useActionState, useState, type ReactNode } from "react";

import {
  portalAuthFormAction,
  portalGoogleSignInAction,
  type PortalAuthFormState,
  type PortalResult,
} from "@/app/portal/auth-actions";
import { Spinner } from "@/components/ui/spinner";
import { toUserError } from "@/lib/portal/user-errors";

export type PortalAuthMode = "signin" | "signup" | "forgot";
export type PortalAuthRole = "student" | "supervisor";

const INPUT =
  "border-dash-border bg-white/90 text-dash-foreground focus:ring-dash-accent/30 w-full rounded-md border px-3.5 py-2.5 text-sm outline-none focus:ring-2 dark:bg-dash-card/90";
const BTN =
  "bg-dash-accent inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60";
const SECONDARY =
  "border-dash-border bg-dash-card text-dash-foreground hover:bg-dash-muted/40 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60";

/** Free Unsplash photo (students collaborating) — loaded from CDN. */
export const PORTAL_AUTH_HERO_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=80";

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

function GoogleButton({ role }: { role: PortalAuthRole }) {
  const [msg, setMsg] = useState<PortalResult | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        className={SECONDARY}
        onClick={() => {
          setMsg(null);
          setPending(true);
          void portalGoogleSignInAction(role)
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
        {pending ? "Connecting…" : "Proceed with Google"}
      </button>
      {msg && !msg.ok ? <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{msg.message}</p> : null}
      <div className="text-dash-muted-foreground my-4 flex items-center gap-3 text-xs">
        <span className="bg-dash-border h-px flex-1" />
        or with email
        <span className="bg-dash-border h-px flex-1" />
      </div>
    </>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rounded-sm px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? "bg-dash-accent text-white" : "text-dash-muted-foreground hover:text-dash-foreground"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const ROLE_COPY: Record<
  PortalAuthRole,
  { eyebrow: string; headline: string; blurb: string; formTitle: string; formSub: string }
> = {
  student: {
    eyebrow: "Honic · Student",
    headline: "Build your project workspace with clear ownership",
    blurb: "Register once, pick a plan, claim a title, and share progress with your supervisor.",
    formTitle: "Student portal",
    formSub: "Use your school or personal email. Staff sign in on Inova separately.",
  },
  supervisor: {
    eyebrow: "Honic · Supervisor",
    headline: "Guide student projects with a clear, shared view",
    blurb: "Sign in with the email your student saved. Review plans, shared documents, and progress in one place.",
    formTitle: "Supervisor portal",
    formSub: "Use the same email the student listed for you.",
  },
};

export function PortalAuth({
  initialStatus,
  googleEnabled = false,
  initialMode = "signup",
  initialRole = "student",
  prefillEmail = "",
  projectHint = "",
  lockRole = false,
}: {
  initialStatus?: PortalResult | null;
  googleEnabled?: boolean;
  initialMode?: PortalAuthMode;
  initialRole?: PortalAuthRole;
  prefillEmail?: string;
  projectHint?: string;
  /** When true, hide role picker (e.g. deep-link from student share). */
  lockRole?: boolean;
}) {
  const [mode, setMode] = useState<PortalAuthMode>(initialMode);
  const [role, setRole] = useState<PortalAuthRole>(initialRole);
  const [state, formAction, pending] = useActionState<PortalAuthFormState, FormData>(
    portalAuthFormAction,
    initialStatus ?? null,
  );

  const copy = ROLE_COPY[role];
  const submitLabel =
    mode === "forgot"
      ? "Send reset link"
      : mode === "signup"
        ? role === "supervisor"
          ? "Create supervisor account"
          : "Create student account"
        : role === "supervisor"
          ? "Sign in to projects"
          : "Sign in securely";

  return (
    <div className="border-dash-border bg-dash-card/95 grid overflow-hidden rounded-md border shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)] backdrop-blur-md lg:grid-cols-2">
      <div className="relative min-h-[14rem] lg:min-h-full">
        <Image
          src={PORTAL_AUTH_HERO_IMAGE}
          alt="Students and supervisors collaborating on a project"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1c2c]/90 via-[#0b1c2c]/35 to-transparent lg:bg-gradient-to-r" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase">{copy.eyebrow}</p>
          <h2 className="mt-2 max-w-sm text-2xl font-semibold tracking-tight text-white sm:text-3xl">{copy.headline}</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/80">{copy.blurb}</p>
        </div>
      </div>

      <div className="flex flex-col justify-center p-5 sm:p-8">
        {projectHint ? (
          <p className="border-dash-border bg-dash-muted/40 text-dash-muted-foreground mb-4 rounded-md border px-3 py-2 text-xs leading-relaxed">
            Shared by a student for <strong className="text-dash-foreground">{projectHint}</strong>. Create an account or
            sign in to open their workspace.
          </p>
        ) : null}

        <div className="mb-5">
          <h1 className="text-dash-foreground text-xl font-semibold tracking-tight sm:text-2xl">{copy.formTitle}</h1>
          <p className="text-dash-muted-foreground mt-1 text-sm">{copy.formSub}</p>
        </div>

        {mode !== "forgot" ? (
          <div className="bg-dash-muted/50 mb-5 inline-flex rounded-md p-1">
            <ModeButton active={mode === "signin"} onClick={() => setMode("signin")}>
              Sign in
            </ModeButton>
            <ModeButton active={mode === "signup"} onClick={() => setMode("signup")}>
              Create account
            </ModeButton>
          </div>
        ) : (
          <p className="text-dash-muted-foreground mb-5 text-sm">We email a secure link to set a new password.</p>
        )}

        {googleEnabled && mode !== "forgot" ? <GoogleButton role={role} /> : null}

        <form action={formAction} className="space-y-3.5" autoComplete="on" aria-busy={pending}>
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="role" value={role} />

          {mode === "signup" ? (
            <label className="block">
              <span className="text-dash-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase">
                Full name
              </span>
              <input
                name="fullName"
                required
                maxLength={120}
                className={INPUT}
                autoComplete="name"
                placeholder={role === "supervisor" ? "Dr. A. Mwanga" : "Your full name"}
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-dash-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className={INPUT}
              autoComplete="email"
              defaultValue={prefillEmail}
              placeholder={role === "supervisor" ? "supervisor@university.ac.tz" : "you@school.edu"}
            />
          </label>

          {mode !== "forgot" ? (
            <label className="block">
              <span className="text-dash-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase">
                Password
              </span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className={INPUT}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="At least 8 characters"
              />
            </label>
          ) : null}

          {mode === "signup" ? (
            <label className="block">
              <span className="text-dash-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase">
                Confirm password
              </span>
              <input name="password2" type="password" required minLength={8} className={INPUT} autoComplete="new-password" />
            </label>
          ) : null}

          {state && !state.ok ? (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{toUserError(state.message)}</p>
          ) : null}
          {state?.ok && state.message ? (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{state.message}</p>
          ) : null}

          <button type="submit" disabled={pending} className={BTN}>
            {pending ? <Spinner /> : null}
            {pending ? "Please wait…" : submitLabel}
          </button>
        </form>

        <div className="text-dash-muted-foreground mt-5 space-y-2 text-xs leading-relaxed">
          {mode === "signin" ? (
            <>
              <p>
                <button type="button" className="text-dash-accent font-semibold" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              </p>
              <p>
                New here?{" "}
                <button
                  type="button"
                  className="text-dash-accent font-semibold"
                  onClick={() => {
                    setRole("student");
                    setMode("signup");
                  }}
                >
                  Create an account
                </button>
              </p>
            </>
          ) : null}
          {mode === "signup" ? (
            <p>
              Already registered?{" "}
              <button type="button" className="text-dash-accent font-semibold" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </p>
          ) : null}
          {mode === "forgot" ? (
            <p>
              Remembered it?{" "}
              <button type="button" className="text-dash-accent font-semibold" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            </p>
          ) : null}
          {!lockRole && mode !== "forgot" ? (
            <p>
              {role === "supervisor" ? (
                <>
                  Need a student account?{" "}
                  <button
                    type="button"
                    className="text-dash-accent font-semibold"
                    onClick={() => {
                      setRole("student");
                      setMode("signup");
                    }}
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Supervising a project?{" "}
                  <button
                    type="button"
                    className="text-dash-accent font-semibold"
                    onClick={() => {
                      setRole("supervisor");
                      setMode("signup");
                    }}
                  >
                    Supervisor account
                  </button>
                </>
              )}
            </p>
          ) : null}
          <p>
            Staff accounts belong on{" "}
            <a className="text-dash-accent font-semibold" href="https://inova.honiccompany.com/login">
              inova.honiccompany.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
