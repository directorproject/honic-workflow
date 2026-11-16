import Image from "next/image";
import Link from "next/link";

import { NEXIS_BRAND_NAME, NEXIS_MARK_SRC } from "@/lib/portal/brand";

type Tone = "light" | "dark";

/**
 * Icon mark + one-row bold wordmark: Honic Nexis.
 */
export function NexisWordmark({
  href = "/portal",
  tone = "light",
  size = "md",
  subtitle,
}: {
  href?: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
}) {
  const box =
    size === "lg" ? "h-11 w-11 sm:h-12 sm:w-12" : size === "sm" ? "h-8 w-8 sm:h-9 sm:w-9" : "h-9 w-9 sm:h-10 sm:w-10";
  const title =
    size === "lg"
      ? "text-base sm:text-lg"
      : size === "sm"
        ? "text-sm sm:text-[0.95rem]"
        : "text-sm sm:text-base";
  const titleColor = tone === "dark" ? "text-white" : "text-dash-foreground";
  const accent = tone === "dark" ? "text-sky-300" : "text-dash-accent";
  const muted = tone === "dark" ? "text-white/60" : "text-dash-muted-foreground";

  return (
    <Link href={href} className="flex min-w-0 items-center gap-2.5 sm:gap-3" aria-label={NEXIS_BRAND_NAME}>
      <span className={`relative ${box} shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10`}>
        <Image
          src={NEXIS_MARK_SRC}
          alt=""
          fill
          className="object-cover"
          sizes="48px"
          priority
          unoptimized
        />
      </span>
      <span className="min-w-0">
        <span className={`flex flex-wrap items-baseline gap-x-1.5 font-extrabold tracking-tight ${title}`}>
          <span className={titleColor}>Honic</span>
          <span className={accent}>Nexis</span>
        </span>
        {subtitle ? (
          <span className={`mt-0.5 block truncate text-[10px] font-semibold tracking-[0.14em] uppercase ${muted}`}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
