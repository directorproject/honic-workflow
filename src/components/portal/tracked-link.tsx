"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

import { trackLinkClick } from "@/lib/portal/track-link-client";

type NextLinkProps = ComponentProps<typeof Link>;

function onTrack(
  e: MouseEvent<HTMLAnchorElement>,
  linkKey: string,
  label: string,
  href: string,
) {
  // Allow modified clicks (new tab, etc.) without delaying navigation.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
    trackLinkClick({ linkKey, label, href });
    return;
  }
  trackLinkClick({ linkKey, label, href });
}

/** Internal Next.js link that records a click for staff analytics. */
export function TrackedLink({
  linkKey,
  trackLabel,
  href,
  children,
  className,
  onClick,
  ...rest
}: NextLinkProps & {
  linkKey: string;
  trackLabel?: string;
  children: ReactNode;
}) {
  const hrefStr = typeof href === "string" ? href : href.pathname ?? "";
  const label = trackLabel ?? (typeof children === "string" ? children : linkKey);

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        onTrack(e, linkKey, label, hrefStr);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

/** External / tel / mailto / WhatsApp anchor with click analytics. */
export function TrackedAnchor({
  linkKey,
  trackLabel,
  href,
  children,
  className,
  onClick,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  linkKey: string;
  trackLabel?: string;
  href: string;
  children: ReactNode;
}) {
  const label = trackLabel ?? (typeof children === "string" ? children : linkKey);

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        onTrack(e, linkKey, label, href);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
