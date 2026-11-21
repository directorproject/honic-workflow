import type { ReactNode } from "react";

import { isStaffOrInovaAbsoluteUrl } from "@/lib/portal/staff-host";

const URL_RE = /https?:\/\/[^\s<>"'）)\]]+/gi;

function trimTrailingPunctuation(url: string): { href: string; trailing: string } {
  let href = url;
  let trailing = "";
  while (/[.,;:!?)]$/.test(href)) {
    trailing = href.slice(-1) + trailing;
    href = href.slice(0, -1);
  }
  return { href, trailing };
}

/** Renders plain text with http(s) URLs as coloured, clickable links. */
export function LinkifiedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const { href, trailing } = trimTrailingPunctuation(match[0]);
    // Never turn staff / Inova dashboard URLs into clickable links on the student portal.
    if (isStaffOrInovaAbsoluteUrl(href)) {
      nodes.push(href);
    } else {
      nodes.push(
        <a
          key={`u-${key++}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 underline decoration-blue-700/40 underline-offset-2 break-all hover:text-blue-900 dark:text-blue-400 dark:decoration-blue-400/40 dark:hover:text-blue-300"
        >
          {href}
        </a>,
      );
    }
    if (trailing) nodes.push(trailing);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <span className={className}>{nodes}</span>;
}
