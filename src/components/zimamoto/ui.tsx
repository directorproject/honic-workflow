import type { ReactNode } from "react";

import { UserAvatar } from "@/components/ui/user-avatar";

/** Initials avatar with a stable colour per name (no photos needed). */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return <UserAvatar name={name} size={size} />;
}

export function Chip({ tone, children }: { tone: "public" | "private" | "neutral"; children: ReactNode }) {
  const styles = {
    public: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    private: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    neutral: "bg-dash-muted text-dash-muted-foreground",
  }[tone];
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}>{children}</span>;
}
