"use client";

import type { ReactNode } from "react";
import Link from "next/link";

const STORAGE_PREFIX = "shareListScroll:";

function rememberScrollForReturn() {
  try {
    const path = window.location.pathname;
    sessionStorage.setItem(`${STORAGE_PREFIX}${path}`, String(window.scrollY));
  } catch {
    /* private mode / quota */
  }
}

/**
 * Share file list → preview: save scroll so “Back to project” returns to the same place (esp. mobile).
 */
export function SharePreviewLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} scroll={false} onClick={rememberScrollForReturn}>
      {children}
    </Link>
  );
}
