"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { PlanModeChip } from "@/components/portal/plan-mode-chip";
import { PortalNavLinks, usePortalActiveLabel, type PortalNavMode } from "@/components/portal/portal-nav";
import { SiteFooter } from "@/components/portal/site-footer";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";

export { portalNavGroups, type PortalNavGroup, type PortalNavItem, type PortalNavMode } from "@/components/portal/portal-nav";

export function PortalShell({
  viewer,
  hasWorkspace,
  hasProgress = false,
  mode = "student",
  workspaceBase,
  deskExpiresAt = null,
  children,
}: {
  viewer: { name: string; detail: string | null };
  hasWorkspace: boolean;
  hasProgress?: boolean;
  mode?: PortalNavMode;
  /** When viewing a supervised project: /supervisor/p/<id> */
  workspaceBase?: string;
  /** Student desk membership end date; used to show Free plan / Paid plan in the top bar. */
  deskExpiresAt?: string | null;
  children: ReactNode;
}) {
  const hasPaidDesk = mode !== "student" || hasActiveDeskPlan(deskExpiresAt);
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = search.get("tab") ?? "home";
  const [drawer, setDrawer] = useState(false);
  const [isLg, setIsLg] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const activeLabel = usePortalActiveLabel({ mode, hasWorkspace, hasProgress, workspaceBase, hasPaidDesk });

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsLg(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const navKey = `${pathname}?tab=${tab}`;
  const [prevNavKey, setPrevNavKey] = useState(navKey);
  if (navKey !== prevNavKey) {
    setPrevNavKey(navKey);
    if (drawer) setDrawer(false);
  }

  const sidebarVisible = isLg || drawer;
  const navId = mode === "supervisor" ? "supervisor-side-nav" : "portal-home-side-nav";

  return (
    <div className="bg-dash-canvas text-dash-foreground min-h-screen overflow-x-hidden">
      {drawer ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawer(false)}
        />
      ) : null}

      <aside
        id={navId}
        aria-hidden={sidebarVisible ? undefined : true}
        inert={!sidebarVisible ? true : undefined}
        className={`bg-dash-sidebar fixed inset-y-0 left-0 z-50 w-[17rem] -translate-x-full overflow-y-auto px-3 py-5 shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ${drawer ? "max-lg:translate-x-0" : "max-lg:pointer-events-none"}`}
      >
        <PortalNavLinks
          mode={mode}
          hasWorkspace={hasWorkspace}
          hasProgress={hasProgress}
          hasPaidDesk={hasPaidDesk}
          workspaceBase={workspaceBase}
          onSide
        />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[17rem]">
        <header
          className={`border-dash-border bg-dash-card/95 supports-[backdrop-filter]:bg-dash-card/80 fixed top-0 right-0 left-0 z-30 border-b backdrop-blur-md transition-shadow duration-300 lg:left-[17rem] ${
            scrolled ? "shadow-[0_8px_24px_-16px_rgba(15,23,42,0.55)]" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-2 sm:gap-4 sm:px-6 sm:py-3">
            <button
              type="button"
              className="hover:bg-dash-muted inline-flex shrink-0 rounded-lg p-2 lg:hidden"
              aria-expanded={drawer}
              aria-controls={navId}
              aria-label={drawer ? "Hide sidebar" : "Show sidebar"}
              onClick={() => setDrawer((open) => !open)}
            >
              {drawer ? <CloseIcon /> : <MenuIcon />}
            </button>
            <div className="min-w-0 flex-1 pr-1">
              <h1 className="text-dash-foreground truncate text-[0.95rem] leading-tight font-semibold tracking-tight sm:text-xl">
                {activeLabel}
              </h1>
              <p className="text-dash-muted-foreground mt-0.5 truncate text-[11px] leading-snug sm:text-sm">
                {viewer.detail ?? viewer.name}
              </p>
            </div>
            <div className="border-dash-border flex shrink-0 items-center gap-1 border-l pl-1.5 sm:gap-2 sm:pl-3">
              <ThemeToggle />
              {mode === "student" ? <PlanModeChip deskExpiresAt={deskExpiresAt} compact /> : null}
              <span className="bg-dash-accent hidden h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white sm:inline-flex">
                {viewer.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-[10rem] truncate text-xs font-medium md:inline">{viewer.name}</span>
              {mode === "supervisor" ? (
                <span className="bg-violet-500/15 text-violet-800 dark:text-violet-200 hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase sm:inline">
                  Supervisor
                </span>
              ) : null}
            </div>
          </div>
          <span className={`bg-dash-accent block h-0.5 origin-left transition-transform duration-500 ${scrolled ? "scale-x-100" : "scale-x-0"}`} />
        </header>
        {/* Matches fixed header height so content is not covered. */}
        <div className="h-[3.6rem] shrink-0 sm:h-[4.25rem]" aria-hidden />

        <div className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-5 lg:px-8">{children}</div>
        <SiteFooter />
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
    </svg>
  );
}
