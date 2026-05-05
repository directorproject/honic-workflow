"use client";

import { useState } from "react";
import Link from "next/link";

export function ShareBackToProjectLink({ href }: { href: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <>
      <Link
        href={href}
        scroll={false}
        onClick={() => setLoading(true)}
        className="border-dash-border bg-dash-card text-dash-foreground hover:border-dash-accent/40 focus-visible:ring-dash-accent inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-center text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        ← Back to project
      </Link>
      {loading ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div className="border-dash-border bg-dash-card text-dash-foreground inline-flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-xl">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-dash-accent/30 border-t-dash-accent" aria-hidden />
            <span className="text-sm font-semibold">Opening project...</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
