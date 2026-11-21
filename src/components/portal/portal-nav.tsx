"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { portalSignOutAction } from "@/app/portal/auth-actions";
import { supervisorSignOutAction } from "@/app/supervisor/auth-actions";
import { NexisWordmark } from "@/components/brand/nexis-wordmark";
import { tabHref } from "@/lib/workspace/links";

export type PortalNavItem = {
  key: string;
  label: string;
  href: string;
  /** Match these tab values as active for this item. */
  tabs?: string[];
  external?: boolean;
  /** Optional unread badge count (e.g. new peer-help offers). */
  badge?: number;
};

export type PortalNavGroup = {
  label: string;
  items: PortalNavItem[];
};

export type PortalNavMode = "student" | "supervisor";

export function portalNavGroups(opts: {
  mode?: PortalNavMode;
  hasWorkspace: boolean;
  hasProgress?: boolean;
  /** Project workspace URL prefix, e.g. /supervisor/p/<id> or /portal/home */
  workspaceBase?: string;
  /** When false, Help desk is labeled as plan-locked (still linkable to upgrade wall). */
  hasPaidDesk?: boolean;
  /** Unread peer-help offer count for Peer help nav badge. */
  jobsBadge?: number;
}): PortalNavGroup[] {
  const mode = opts.mode ?? "student";
  const jobsBadge = Math.max(0, Math.round(Number(opts.jobsBadge) || 0));

  if (mode === "supervisor") {
    const base = opts.workspaceBase ?? "";
    const projectTabs: PortalNavGroup[] = opts.hasWorkspace && base
      ? [
          {
            label: "Workspace",
            items: [
              { key: "home", label: "Home", href: tabHref(base, "home"), tabs: ["home"] },
              { key: "project", label: "Project details", href: tabHref(base, "project"), tabs: ["project"] },
            ],
          },
          {
            label: "Plan",
            items: [
              { key: "gantt", label: "Gantt chart", href: tabHref(base, "gantt"), tabs: ["gantt"] },
              { key: "tasks", label: "Task board", href: tabHref(base, "tasks"), tabs: ["tasks"] },
              { key: "calendar", label: "Calendar", href: tabHref(base, "calendar"), tabs: ["calendar"] },
              { key: "field", label: "Field study", href: tabHref(base, "field"), tabs: ["field"] },
            ],
          },
          {
            label: "Review",
            items: [
              { key: "review", label: "Shared documents", href: tabHref(base, "review"), tabs: ["review", "documents", "corrections"] },
              { key: "files", label: "Project files", href: tabHref(base, "files"), tabs: ["files"] },
              { key: "logbook", label: "Logbook", href: tabHref(base, "logbook"), tabs: ["logbook"] },
              { key: "data", label: "Data and results", href: tabHref(base, "data"), tabs: ["data"] },
              { key: "references", label: "References", href: tabHref(base, "references"), tabs: ["references"] },
            ],
          },
        ]
      : [];

    return [
      {
        label: "Supervisor",
        items: [{ key: "projects", label: "My projects", href: "/supervisor", tabs: ["projects"] }],
      },
      ...projectTabs,
    ];
  }

  const base = opts.workspaceBase ?? "/portal/home";
  /** Full menu always — free users can open every link; screens gate the real service. */
  const plan: PortalNavItem[] = [
    { key: "gantt", label: "Gantt chart", href: tabHref(base, "gantt"), tabs: ["gantt"] },
    { key: "calendar", label: "Calendar", href: tabHref(base, "calendar"), tabs: ["calendar"] },
    { key: "field", label: "Field study", href: tabHref(base, "field"), tabs: ["field"] },
  ];
  const honic: PortalNavItem[] = [
    {
      key: "jobs",
      label: "Peer help",
      href: "/portal/jobs",
      external: true,
      badge: jobsBadge > 0 ? jobsBadge : undefined,
    },
    { key: "zimamoto", label: "Zimamoto", href: "/portal/zimamoto", external: true },
    { key: "messages", label: "Help desk", href: tabHref(base, "messages"), tabs: ["messages"] },
  ];

  return [
    {
      label: "Workspace",
      items: [{ key: "home", label: "Home", href: base, tabs: ["home"] }],
    },
    { label: "Plan", items: plan },
    {
      label: "Work",
      items: [
        { key: "review", label: "Review", href: tabHref(base, "review"), tabs: ["review", "documents", "corrections"] },
        { key: "files", label: "Project files", href: tabHref(base, "files"), tabs: ["files"] },
      ],
    },
    {
      label: "Team & supervisor",
      items: [{ key: "team", label: "Team & supervisor", href: tabHref(base, "team"), tabs: ["team"] }],
    },
    { label: "Honic", items: honic },
    {
      label: "You",
      items: [
        { key: "projects", label: "My projects & titles", href: tabHref(base, "projects"), tabs: ["projects", "title"] },
        { key: "payments", label: "Payments & invoices", href: tabHref(base, "payments"), tabs: ["payments"] },
        { key: "account", label: "My account", href: tabHref(base, "account"), tabs: ["account"] },
        { key: "titles", label: "Literature review", href: "/portal/titles", external: true },
        { key: "packs", label: "Plans & access", href: "/portal/packs", external: true },
      ],
    },
  ];
}

export function portalItemActive(
  item: PortalNavItem,
  pathname: string,
  tab: string,
  mode: PortalNavMode = "student",
): boolean {
  if (item.external) return pathname.startsWith(item.href);

  if (mode === "supervisor") {
    if (item.key === "projects") return pathname === "/supervisor" || pathname === "/supervisor/";
    if (pathname.startsWith("/supervisor/p/")) {
      if (item.key === "home") return tab === "home" || !tab;
      return Boolean(item.tabs?.includes(tab));
    }
    return false;
  }

  if (item.key === "home") return pathname === "/portal/home" && (tab === "home" || !tab);
  return pathname === "/portal/home" && Boolean(item.tabs?.includes(tab));
}

/** Same side-nav links used on portal home and literature pages. */
export function PortalNavLinks({
  mode = "student",
  hasWorkspace,
  hasProgress = false,
  hasPaidDesk = true,
  workspaceBase,
  onSide = true,
  brand = true,
  /** Rendered under the brand and above the main nav (e.g. title filters). */
  topExtras,
  extras,
  showSignOut = true,
  jobsBadge = 0,
}: {
  mode?: PortalNavMode;
  hasWorkspace: boolean;
  hasProgress?: boolean;
  hasPaidDesk?: boolean;
  workspaceBase?: string;
  onSide?: boolean;
  brand?: boolean;
  topExtras?: ReactNode;
  extras?: ReactNode;
  showSignOut?: boolean;
  jobsBadge?: number;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = search.get("tab") ?? "home";
  const groups = portalNavGroups({ mode, hasWorkspace, hasProgress, workspaceBase, hasPaidDesk, jobsBadge });
  const homeHref = mode === "supervisor" ? "/supervisor" : "/portal/home";
  const signOut = mode === "supervisor" ? supervisorSignOutAction : portalSignOutAction;

  return (
    <div className={`flex h-full flex-col ${onSide ? "gap-0" : "gap-4 space-y-0"}`}>
      {brand && onSide ? (
        <div className="bg-dash-sidebar sticky top-0 z-20 shrink-0">
          {/* Same height as main header (see portal-shell spacer). Stays put while filters/nav scroll. */}
          <div className="relative flex h-[3.6rem] items-center px-3 sm:h-[4.25rem]">
            <NexisWordmark
              href={homeHref}
              tone="dark"
              size="sm"
              subtitle={mode === "supervisor" ? "Supervisor portal" : "Student portal"}
            />
            {/* Bold blue rule: starts at center of logo strip, ends at right edge of nav. */}
            <span aria-hidden className="bg-dash-accent pointer-events-none absolute right-0 bottom-0 left-1/2 h-0.5" />
          </div>
        </div>
      ) : null}

      {topExtras ? <div className={onSide ? "mt-4 px-3" : undefined}>{topExtras}</div> : null}

      <nav
        aria-label={mode === "supervisor" ? "Supervisor" : "Portal"}
        className={onSide ? "mt-4 space-y-5 px-3" : "space-y-4"}
      >
        {groups.map((group) => (
          <div key={group.label}>
            <p className={`px-3 pb-1 text-[10px] font-semibold tracking-widest uppercase ${onSide ? "text-white/45" : "text-dash-muted-foreground"}`}>
              {group.label}
            </p>
            <ul className={onSide ? "space-y-0.5" : "flex flex-wrap gap-2"}>
              {group.items.map((item) => {
                const on = portalItemActive(item, pathname, tab, mode);
                const badge = item.badge && item.badge > 0 ? (item.badge > 9 ? "9+" : String(item.badge)) : null;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      prefetch
                      aria-current={on ? "page" : undefined}
                      className={
                        onSide
                          ? `flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium ${on ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`
                          : `inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${on ? "border-dash-foreground bg-dash-foreground text-dash-card" : "border-dash-border text-dash-muted-foreground"}`
                      }
                    >
                      <span>{item.label}</span>
                      {badge ? (
                        <span
                          className={
                            onSide
                              ? "inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950"
                              : "bg-dash-accent inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                          }
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {extras}

      {showSignOut ? (
        <form action={signOut} className={onSide ? "mt-auto px-3 pt-4" : undefined}>
          <button type="submit" className={onSide ? "text-sm text-white/70 hover:text-white" : "text-dash-muted-foreground text-sm font-semibold"}>
            Sign out
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function usePortalActiveLabel(opts: {
  mode?: PortalNavMode;
  hasWorkspace: boolean;
  hasProgress?: boolean;
  hasPaidDesk?: boolean;
  workspaceBase?: string;
}): string {
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = search.get("tab") ?? "home";
  const mode = opts.mode ?? "student";
  const groups = portalNavGroups({
    mode,
    hasWorkspace: opts.hasWorkspace,
    hasProgress: opts.hasProgress,
    hasPaidDesk: opts.hasPaidDesk,
    workspaceBase: opts.workspaceBase,
  });
  const found = groups.flatMap((g) => g.items).find((item) => portalItemActive(item, pathname, tab, mode));
  return found?.label ?? (mode === "supervisor" ? "Supervisor portal" : "Honic Nexis");
}
