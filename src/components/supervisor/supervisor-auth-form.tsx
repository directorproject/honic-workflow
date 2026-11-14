"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import { supervisorAuthFormAction, type SupervisorAuthFormState } from "@/app/supervisor/auth-actions";

const INPUT =
  "border-dash-border bg-white/90 text-dash-foreground focus:ring-dash-accent/30 w-full rounded-md border px-3.5 py-2.5 text-sm outline-none focus:ring-2 dark:bg-dash-card/90";
const BTN =
  "bg-dash-accent inline-flex w-full cursor-pointer items-center justify-center rounded-md px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60";

/** Free Unsplash photo (students collaborating) — loaded from CDN. */
export const SUPERVISOR_HERO_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1800&q=80";

export function SupervisorAuthForm({
  initialMode = "signin",
  prefillEmail = "",
  projectHint = "",
}: {
  initialMode?: "signin" | "signup";
  prefillEmail?: string;
  /** Optional project name shown when a student shared this form. */
  projectHint?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [state, action, pending] = useActionState<SupervisorAuthFormState, FormData>(supervisorAuthFormAction, null);

  return (
    <div className="border-dash-border bg-dash-card/95 grid overflow-hidden rounded-md border shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)] backdrop-blur-md lg:grid-cols-2">
      <div className="relative min-h-[14rem] lg:min-h-full">
        <Image
          src={SUPERVISOR_HERO_IMAGE}
          alt="Students collaborating on a project with guidance"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1c2c]/90 via-[#0b1c2c]/35 to-transparent lg:bg-gradient-to-r" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase">Honic · Supervisor</p>
          <h2 className="mt-2 max-w-sm text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Guide student projects with a clear, shared view
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/80">
            Sign in with the email your student saved. Review plans, shared documents, and progress in one place.
          </p>
          <a
            href={SUPERVISOR_HERO_IMAGE}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex text-xs font-semibold text-white/75 underline-offset-2 hover:text-white hover:underline"
          >
            Download hero image (Unsplash) →
          </a>
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
          <h1 className="text-dash-foreground text-xl font-semibold tracking-tight sm:text-2xl">Supervisor portal</h1>
          <p className="text-dash-muted-foreground mt-1 text-sm">Use the same email the student listed for you.</p>
        </div>

        <div className="bg-dash-muted/50 mb-5 inline-flex rounded-md p-1">
          <button
            type="button"
            className={`rounded-sm px-3.5 py-1.5 text-sm font-semibold transition ${
              mode === "signin" ? "bg-dash-accent text-white" : "text-dash-muted-foreground hover:text-dash-foreground"
            }`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`rounded-sm px-3.5 py-1.5 text-sm font-semibold transition ${
              mode === "signup" ? "bg-dash-accent text-white" : "text-dash-muted-foreground hover:text-dash-foreground"
            }`}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>

        <form action={action} className="space-y-3.5">
          <input type="hidden" name="mode" value={mode} />
          {mode === "signup" ? (
            <label className="block">
              <span className="text-dash-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase">
                Full name
              </span>
              <input name="fullName" required maxLength={120} className={INPUT} autoComplete="name" placeholder="Dr. A. Mwanga" />
            </label>
          ) : null}
          <label className="block">
            <span className="text-dash-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase">Email</span>
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className={INPUT}
              autoComplete="email"
              defaultValue={prefillEmail}
              placeholder="supervisor@university.ac.tz"
            />
          </label>
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
          {mode === "signup" ? (
            <label className="block">
              <span className="text-dash-muted-foreground mb-1.5 block text-xs font-semibold tracking-wide uppercase">
                Confirm password
              </span>
              <input name="password2" type="password" required minLength={8} className={INPUT} autoComplete="new-password" />
            </label>
          ) : null}
          {state && !state.ok ? <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{state.message}</p> : null}
          {state?.ok && state.message ? (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{state.message}</p>
          ) : null}
          <button type="submit" disabled={pending} className={BTN}>
            {pending ? "Please wait…" : mode === "signup" ? "Create supervisor account" : "Sign in to projects"}
          </button>
        </form>

        <p className="text-dash-muted-foreground mt-5 text-xs leading-relaxed">
          After sign-in you see every project that lists your email under Team & supervisor.{" "}
          <Link href="/portal" className="text-dash-accent font-semibold">
            Student portal
          </Link>
        </p>
      </div>
    </div>
  );
}
