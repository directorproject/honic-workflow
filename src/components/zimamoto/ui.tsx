import type { ReactNode } from "react";

const GRADIENTS = [
  "from-cyan-500 to-sky-600",
  "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-rose-500 to-pink-600",
  "from-blue-500 to-indigo-500",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

function gradientFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** Initials avatar with a stable colour per name (no photos needed). */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(name)} font-semibold text-white`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Chip({ tone, children }: { tone: "public" | "private" | "neutral"; children: ReactNode }) {
  const styles = {
    public: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    private: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    neutral: "bg-dash-muted text-dash-muted-foreground",
  }[tone];
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}>{children}</span>;
}
