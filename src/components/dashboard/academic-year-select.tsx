"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore, useTransition } from "react";

import {
  ACADEMIC_YEAR_COOKIE,
  academicYearLabel,
  parseAcademicYearSelection,
  selectableAcademicYears,
} from "@/lib/academic-year";

function readCookie(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACADEMIC_YEAR_COOKIE}=([^;]*)`));
  return String(parseAcademicYearSelection(match ? decodeURIComponent(match[1]) : null));
}

const subscribe = () => () => {};

export function AcademicYearSelect() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const value = useSyncExternalStore(subscribe, readCookie, () => null);

  if (value === null) return null;

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-dash-muted-foreground text-xs font-medium">Year</span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          document.cookie = `${ACADEMIC_YEAR_COOKIE}=${encodeURIComponent(e.target.value)}; path=/; max-age=31536000; samesite=lax`;
          startTransition(() => router.refresh());
        }}
        className="border-dash-border bg-dash-card text-dash-foreground rounded-lg border px-2 py-1 text-xs font-semibold disabled:opacity-50"
        title="Working year runs 30 September to 29 September"
      >
        {selectableAcademicYears().map((y) => (
          <option key={y} value={String(y)}>
            {academicYearLabel(y)}
          </option>
        ))}
        <option value="all">All years</option>
      </select>
    </label>
  );
}
