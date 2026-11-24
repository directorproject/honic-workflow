"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { portalProductGuidePendingAction } from "@/app/portal/actions";
import { NexisWordmark } from "@/components/brand/nexis-wordmark";
import { GuestPreviewBanner } from "@/components/portal/guest-preview-banner";
import { PlanModeChip } from "@/components/portal/plan-mode-chip";
import {
  PortalNewUserGuide,
  shouldShowPortalGuide,
} from "@/components/portal/portal-new-user-guide";
import { PortalNavLinks, usePortalActiveLabel, type PortalNavMode } from "@/components/portal/portal-nav";
import { PosterNotificationsBell, type PosterNotice } from "@/components/portal/poster-notifications-bell";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SiteFooter } from "@/components/portal/site-footer";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { needsProductGuide } from "@/lib/portal/product-guide";
import { hasActiveDeskPlan } from "@/lib/portal/title-limits";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export { portalNavGroups, type PortalNavGroup, type PortalNavItem, type PortalNavMode } from "@/components/portal/portal-nav";

export function PortalShell({
  viewer,
  hasWorkspace,
  hasProgress = false,
  mode = "student",
  workspaceBase,
  deskExpiresAt = null,
  deskPlan = null,
  guest = false,
  forceGuide = false,
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
  deskPlan?: string | null;
  /** Anonymous browse: full nav visible, actions locked, sign-in CTA. */
  guest?: boolean;
  /** Server says this student still owes the mandatory product tour. */
  forceGuide?: boolean;
  children: ReactNode;
}) {
  const hasPaidDesk = guest ? false : mode !== "student" || hasActiveDeskPlan(deskExpiresAt);
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const tab = search.get("tab") ?? "home";
  // ?guide=1 starts the tour (works for signed-in and guest preview); forceGuide is account-required.
  const guideFromUrl = mode === "student" && shouldShowPortalGuide(search.get("guide"), search.get("nav"));
  const guideShouldStart = mode === "student" && (guideFromUrl || (!guest && forceGuide));
  const [guideActive, setGuideActive] = useState(guideShouldStart);
  const [guideRequired, setGuideRequired] = useState(!guest && mode === "student" && forceGuide);
  const [drawer, setDrawer] = useState(false);
  const [isLg, setIsLg] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [jobsBadge, setJobsBadge] = useState(0);
  const [noticeItems, setNoticeItems] = useState<PosterNotice[]>([]);
  const activeLabel = usePortalActiveLabel({ mode, hasWorkspace, hasProgress, workspaceBase, hasPaidDesk });

  useEffect(() => {
    if (guideShouldStart) {
      setGuideActive(true);
      if (forceGuide) setGuideRequired(true);
    }
  }, [guideShouldStart, forceGuide]);

  // Keep the required tour open until the account is marked done (missing flag = still owed).
  useEffect(() => {
    if (guest || mode !== "student") return;
    if (forceGuide) {
      setGuideRequired(true);
      setGuideActive(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const browser = getSupabaseBrowserClient();
        if (browser) {
          const { data } = await browser.auth.getUser();
          if (data.user && needsProductGuide(data.user)) {
            if (!cancelled) {
              setGuideRequired(true);
              setGuideActive(true);
            }
            return;
          }
          if (data.user && !needsProductGuide(data.user)) return;
        }
        const pending = await portalProductGuidePendingAction();
        if (!cancelled && pending) {
          setGuideRequired(true);
          setGuideActive(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guest, mode, pathname, forceGuide]);

  const refreshJobNotices = useCallback(async () => {
    if (guest || mode !== "student") return;
    try {
      const res = await fetch("/api/portal/job-notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        unread?: number;
        items?: PosterNotice[];
      };
      setJobsBadge(Math.max(0, Number(data.unread) || 0));
      setNoticeItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      /* ignore */
    }
  }, [guest, mode]);

  // Near real-time for posters: poll often + refresh when tab becomes visible / window focused.
  useEffect(() => {
    void refreshJobNotices();
    if (guest || mode !== "student") return;
    const t = window.setInterval(() => {
      void refreshJobNotices();
    }, 5000);
    function onFocus() {
      void refreshJobNotices();
    }
    function onVis() {
      if (!document.hidden) void refreshJobNotices();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [guest, mode, refreshJobNotices]);

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

  // Clear ?guide=1 / ?nav=1 from the URL once the tour is showing (finish navigates to plans).
  useEffect(() => {
    if (!guideActive) return;
    const params = new URLSearchParams(search.toString());
    if (!params.has("guide") && !params.has("nav")) return;
    params.delete("guide");
    params.delete("nav");
    const qs = params.toString();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    router.replace(`${pathname}${qs ? `?${qs}` : ""}${hash}`, { scroll: false });
  }, [guideActive, pathname, router, search]);

  const navKey = `${pathname}?tab=${tab}`;
  const [prevNavKey, setPrevNavKey] = useState(navKey);
  if (navKey !== prevNavKey) {
    setPrevNavKey(navKey);
    if (drawer && !guideActive) setDrawer(false);
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
        data-tour="portal-nav"
        aria-hidden={sidebarVisible ? undefined : true}
        inert={!sidebarVisible ? true : undefined}
        className={`bg-dash-sidebar fixed inset-y-0 left-0 z-50 flex w-[17rem] -translate-x-full flex-col overflow-y-auto pb-5 shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ${drawer ? "max-lg:translate-x-0" : "max-lg:pointer-events-none"}`}
      >
        <PortalNavLinks
          mode={mode}
          hasWorkspace={hasWorkspace}
          hasProgress={hasProgress}
          hasPaidDesk={hasPaidDesk}
          workspaceBase={workspaceBase}
          onSide
          showSignOut={!guest}
          jobsBadge={jobsBadge}
        />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[17rem]">
        <header
          className={`border-dash-border bg-dash-card/95 supports-[backdrop-filter]:bg-dash-card/80 fixed top-0 right-0 left-0 z-30 border-b backdrop-blur-md transition-shadow duration-300 lg:left-[17rem] ${
            scrolled ? "shadow-[0_8px_24px_-16px_rgba(15,23,42,0.55)]" : ""
          }`}
        >
          <div className="flex min-h-[3.6rem] items-center gap-x-1.5 gap-y-1 px-2.5 py-1.5 sm:h-[4.25rem] sm:gap-4 sm:px-6 sm:py-0">
            <button
              type="button"
              data-tour="portal-menu"
              className="hover:bg-dash-muted inline-flex shrink-0 rounded-lg p-2 lg:hidden"
              aria-expanded={drawer}
              aria-controls={navId}
              aria-label={drawer ? "Hide sidebar" : "Show sidebar"}
              onClick={() => setDrawer((open) => !open)}
            >
              {drawer ? <CloseIcon /> : <MenuIcon />}
            </button>
            {/* Phone: brand only. Wider phones/desktop show page title instead of both competing. */}
            <div className="min-w-0 flex-1 pr-1 max-[380px]:flex-1 min-[381px]:hidden lg:hidden">
              <NexisWordmark
                href={mode === "supervisor" ? "/supervisor" : "/portal/home"}
                size="sm"
              />
            </div>
            <div className="hidden min-w-0 flex-1 pr-1 min-[381px]:block lg:block">
              <h1 className="text-dash-foreground truncate text-sm leading-tight font-semibold tracking-tight sm:text-[0.95rem] lg:text-xl">
                {activeLabel}
              </h1>
              <p className="text-dash-muted-foreground mt-0.5 hidden truncate text-[11px] leading-snug sm:block sm:text-sm lg:block">
                {viewer.detail ?? viewer.name}
              </p>
            </div>
            <div className="border-dash-border flex shrink-0 items-center gap-0.5 border-l pl-1.5 sm:gap-2 sm:pl-3">
              <span data-tour="portal-theme" className="inline-flex">
                <ThemeToggle />
              </span>
              {mode === "student" && !guest ? (
                <PosterNotificationsBell
                  unread={jobsBadge}
                  items={noticeItems}
                  onRefresh={refreshJobNotices}
                  onChange={({ unread, items }) => {
                    setJobsBadge(unread);
                    setNoticeItems(items);
                  }}
                />
              ) : null}
              {mode === "student" ? (
                <span data-tour="portal-plan" className="inline-flex">
                  <PlanModeChip deskExpiresAt={deskExpiresAt} deskPlan={deskPlan} compact />
                </span>
              ) : null}
              {guest ? (
                <Link
                  href="/portal?auth=signin"
                  className="bg-dash-accent inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white sm:px-3 sm:text-sm"
                >
                  Sign in
                </Link>
              ) : (
                <>
                  <UserAvatar name={viewer.name} size={32} className="sm:h-8 sm:w-8" />
                  <span className="hidden max-w-[10rem] truncate text-xs font-medium md:inline">{viewer.name}</span>
                </>
              )}
              {mode === "supervisor" ? (
                <span className="bg-violet-500/15 text-violet-800 dark:text-violet-200 hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase sm:inline">
                  Supervisor
                </span>
              ) : null}
            </div>
          </div>
          <span
            aria-hidden
            className={`bg-dash-accent pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-500 ${scrolled ? "scale-x-100" : "scale-x-0"}`}
          />
        </header>
        {/* Matches fixed header height so content is not covered. */}
        <div className="h-[3.6rem] shrink-0 sm:h-[4.25rem]" aria-hidden />

        <div className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          {guest ? <GuestPreviewBanner /> : null}
          {children}
        </div>
        <SiteFooter />
      </div>

      <PortalNewUserGuide
        open={guideActive}
        required={guideRequired}
        onOpenMenu={() => setDrawer(true)}
        onCloseMenu={() => setDrawer(false)}
        onDismiss={() => {
          setGuideActive(false);
          setGuideRequired(false);
        }}
      />
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

