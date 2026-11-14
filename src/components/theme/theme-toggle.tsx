"use client";

import { useEffect, useState } from "react";

import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const ORDER: ThemePreference[] = ["system", "light", "dark"];

const LABELS: Record<ThemePreference, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

function readPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

export function ThemeToggle({
  className = "",
  tone = "default",
}: {
  className?: string;
  /** Sidebar uses light icons on dark navy. */
  tone?: "default" | "onDark";
}) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = readPreference();
    setPreference(next);
    applyThemePreference(next);
    setReady(true);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      const current = readPreference();
      if (current === "system") applyThemePreference("system");
    };
    mq.addEventListener("change", onSystem);
    return () => mq.removeEventListener("change", onSystem);
  }, []);

  function cycle() {
    const i = ORDER.indexOf(preference);
    const next = ORDER[(i + 1) % ORDER.length]!;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setPreference(next);
    applyThemePreference(next);
  }

  const iconClass = tone === "onDark" ? "text-white/80" : "text-dash-muted-foreground";
  const btnClass =
    tone === "onDark"
      ? "hover:bg-white/10 text-white/80 hover:text-white"
      : "hover:bg-dash-muted text-dash-muted-foreground hover:text-dash-foreground";

  return (
    <button
      type="button"
      onClick={cycle}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${btnClass} ${className}`}
      aria-label={ready ? `Theme: ${LABELS[preference]}. Click to change.` : "Toggle theme"}
      title={ready ? LABELS[preference] : "Theme"}
    >
      {!ready || preference === "system" ? (
        <SystemIcon className={iconClass} />
      ) : preference === "dark" ? (
        <MoonIcon className={iconClass} />
      ) : (
        <SunIcon className={iconClass} />
      )}
    </button>
  );
}

function SunIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    </svg>
  );
}

function MoonIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
      />
    </svg>
  );
}

function SystemIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
      />
    </svg>
  );
}
