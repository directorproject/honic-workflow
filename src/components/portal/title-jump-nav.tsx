"use client";

import { useEffect, useState } from "react";

export function TitleJumpNav({ jumps }: { jumps: [string, string][] }) {
  const ids = jumps.map(([href]) => href.replace(/^#/, ""));
  const idsKey = ids.join("|");
  const [active, setActive] = useState(ids[0] ?? "details");

  useEffect(() => {
    const sectionIds = idsKey.split("|").filter(Boolean);
    const fromHash = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (id && sectionIds.includes(id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);

    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return () => window.removeEventListener("hashchange", fromHash);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target;
        if (top?.id) setActive(top.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] },
    );
    for (const section of sections) observer.observe(section);

    return () => {
      window.removeEventListener("hashchange", fromHash);
      observer.disconnect();
    };
  }, [idsKey]);

  return (
    <div className="border-dash-border -mx-1 mt-5 flex gap-x-1 overflow-x-auto border-b px-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
      {jumps.map(([href, label]) => {
        const id = href.replace(/^#/, "");
        const on = active === id;
        return (
          <a
            key={href}
            href={href}
            aria-current={on ? "true" : undefined}
            onClick={() => setActive(id)}
            className={`shrink-0 border-b-2 px-2.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
              on
                ? "border-dash-foreground text-dash-foreground"
                : "text-dash-muted-foreground border-transparent hover:text-dash-foreground"
            }`}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
