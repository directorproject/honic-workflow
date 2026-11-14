"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { AcademicYearSelect } from "@/components/dashboard/academic-year-select";
import { useMediaQuery } from "@/components/dashboard/use-media-query";
import { SiteFooter } from "@/components/portal/site-footer";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const STORAGE_PINNED = "dashSidebarPinned";
const STORAGE_WIDTH = "dashSidebarWidth";
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 256;

function clampSidebarWidth(value: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));
}

function storedSidebarWidth(raw: string | null): number {
  if (raw === "narrow") return 224;
  if (raw === "default") return SIDEBAR_DEFAULT;
  if (raw === "wide") return 288;
  const n = Number(raw);
  return Number.isFinite(n) ? clampSidebarWidth(n) : SIDEBAR_DEFAULT;
}

type NavItem = {
  href: string;
  label: string;
  /** Shown in the top bar when the sidebar is closed. */
  top?: boolean;
  /** Custom active match; default is pathname === href or pathname.startsWith(href + "/") */
  isActive?: (pathname: string) => boolean;
  /** Key used to look up a live count badge (e.g. pending title requests). */
  badgeKey?: "pendingTitleRequests" | "helpDeskUnread";
};

type NavSection = { title: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    title: "Main",
    items: [
      { href: "/", label: "Workflow home", top: true, isActive: (p) => p === "/" },
      { href: "/about", label: "About", isActive: (p) => p === "/about" || p.startsWith("/about/") },
    ],
  },
  {
    title: "Projects",
    items: [
      {
        href: "/projects",
        label: "All projects",
        top: true,
        isActive: (p) =>
          p === "/projects" || (p.startsWith("/projects/") && !p.startsWith("/projects/new")),
      },
      {
        href: "/projects/new",
        label: "New project",
        isActive: (p) => p === "/projects/new" || p.startsWith("/projects/new/"),
      },
      {
        href: "/client-side",
        label: "Client side",
        isActive: (p) => p === "/client-side" || p.startsWith("/client-side/"),
      },
      {
        href: "/plans",
        label: "This week milestones",
        top: true,
        isActive: (p) => p === "/plans" || p.startsWith("/plans/"),
      },
      {
        href: "/clients",
        label: "Manage clients",
        top: true,
        isActive: (p) => p === "/clients" || p.startsWith("/clients/"),
      },
      {
        href: "/titles",
        label: "Project titles",
        top: true,
      },
    ],
  },
  {
    title: "Students",
    items: [
      {
        href: "/users",
        label: "Registered users",
        top: true,
        isActive: (p) =>
          p === "/users" || (p.startsWith("/users/") && !p.startsWith("/users/requests")),
      },
      {
        href: "/users/requests",
        label: "Requested titles",
        top: true,
        badgeKey: "pendingTitleRequests",
        isActive: (p) => p === "/users/requests" || p.startsWith("/users/requests/"),
      },
      {
        href: "/students",
        label: "Student workspaces",
        top: true,
        isActive: (p) =>
          p === "/students" ||
          (p.startsWith("/students/") &&
            !p.startsWith("/students/deadlines") &&
            !p.startsWith("/students/help-desk")),
      },
      {
        href: "/students/help-desk",
        label: "Help desk",
        top: true,
        badgeKey: "helpDeskUnread",
        isActive: (p) => p === "/students/help-desk" || p.startsWith("/students/help-desk/"),
      },
      { href: "/students/deadlines", label: "Shared deadlines" },
    ],
  },
  {
    title: "Google Drive",
    items: [
      {
        href: "/drive",
        label: "Browse folders",
        top: true,
        isActive: (p) =>
          p === "/drive" || p.startsWith("/drive/folder/") || p.startsWith("/drive/view/"),
      },
      {
        href: "/drive/upload",
        label: "Upload file",
        isActive: (p) => p === "/drive/upload",
      },
    ],
  },
];

function itemActive(pathname: string, item: NavItem): boolean {
  if (item.isActive) return item.isActive(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="bg-dash-accent ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

type NavBadges = { pendingTitleRequests: number; helpDeskUnread: number };

function navItemBadge(item: NavItem, badges?: Partial<NavBadges> | null): number {
  if (item.badgeKey === "pendingTitleRequests") return badges?.pendingTitleRequests ?? 0;
  if (item.badgeKey === "helpDeskUnread") return badges?.helpDeskUnread ?? 0;
  return 0;
}

function NavLinks({
  pathname,
  layout,
  onNavigate,
  badges = { pendingTitleRequests: 0, helpDeskUnread: 0 },
}: {
  pathname: string;
  layout: "sidebar" | "top";
  onNavigate?: () => void;
  badges?: NavBadges;
}) {
  if (layout === "top") {
    const items = navSections.flatMap((section) => section.items.filter((item) => item.top));
    return (
      <div className="flex items-center gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = itemActive(pathname, item);
          const count = navItemBadge(item, badges);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                active
                  ? "bg-dash-accent/15 text-dash-accent"
                  : "text-dash-muted-foreground hover:bg-dash-muted hover:text-dash-foreground"
              }`}
            >
              {item.label}
              {count > 0 ? (
                <span className="bg-dash-accent inline-flex min-w-4 items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold text-white tabular-nums">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {navSections.map((section) => (
        <div key={section.title}>
          <p className="text-dash-sidebar-muted px-3 pb-2 text-[10px] font-semibold tracking-widest uppercase">
            {section.title}
          </p>
          <ul className="flex flex-col gap-1">
            {section.items.map((item) => {
              const active = itemActive(pathname, item);
              const count = navItemBadge(item, badges);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-dash-accent/20 text-cyan-100 ring-1 ring-cyan-500/30"
                        : "hover:bg-dash-sidebar-hover text-dash-sidebar-muted hover:text-slate-50"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <NavBadge count={count} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

export function DashboardShell({
  children,
  title,
  subtitle,
  statusDotClass,
  headerBelow,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  /** Tailwind bg class for live indicator */
  statusDotClass: string;
  /** Renders directly under the sticky page header (e.g. in-page shortcuts). */
  headerBelow?: React.ReactNode;
}) {
  const isLg = useMediaQuery("(min-width: 1024px)");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [desktopPinned, setDesktopPinned] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [pendingTitleRequests, setPendingTitleRequests] = useState(0);
  const [helpDeskUnread, setHelpDeskUnread] = useState(0);
  const pathname = usePathname();

  const sidebarVisible = isLg ? desktopPinned : mobileDrawerOpen;
  const navBadges = { pendingTitleRequests, helpDeskUnread };

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const pinned = localStorage.getItem(STORAGE_PINNED);
        if (pinned === "0") setDesktopPinned(false);
        setSidebarWidth(storedSidebarWidth(localStorage.getItem(STORAGE_WIDTH)));
      } catch {
        /* ignore */
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadNavBadges() {
      try {
        const res = await fetch("/api/staff/nav-badges", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { pendingTitleRequests?: number; helpDeskUnread?: number; count?: number };
        if (cancelled) return;
        setPendingTitleRequests(Number(data.pendingTitleRequests ?? data.count) || 0);
        setHelpDeskUnread(Number(data.helpDeskUnread) || 0);
      } catch {
        /* ignore */
      }
    }
    void loadNavBadges();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_PINNED, desktopPinned ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [desktopPinned, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_WIDTH, String(sidebarWidth));
    } catch {
      /* ignore */
    }
  }, [sidebarWidth, hydrated]);

  function onResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startW = sidebarWidth;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function move(ev: PointerEvent) {
      setSidebarWidth(clampSidebarWidth(startW + ev.clientX - startX));
    }
    function up() {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function toggleSidebar() {
    if (isLg) {
      setDesktopPinned((p) => !p);
    } else {
      setMobileDrawerOpen((o) => !o);
    }
  }

  function closeMobileDrawer() {
    setMobileDrawerOpen(false);
  }

  return (
    <div className="bg-dash-canvas text-dash-foreground flex min-h-screen">
      <button
        type="button"
        aria-label="Close menu"
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeMobileDrawer}
      />

      <aside
        id="dash-sidebar"
        style={{ width: isLg ? sidebarWidth : SIDEBAR_DEFAULT }}
        className={`border-dash-border bg-dash-sidebar text-dash-sidebar-muted fixed inset-y-0 left-0 z-50 flex flex-col border-r shadow-xl transition-transform duration-200 ease-out ${
          sidebarVisible ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <CompanyBrandBar variant="compact" onNavigate={closeMobileDrawer} />

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3" aria-label="Main navigation">
          <NavLinks
            pathname={pathname}
            layout="sidebar"
            onNavigate={closeMobileDrawer}
            badges={navBadges}
          />
        </nav>

        {isLg && sidebarVisible ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            aria-valuenow={sidebarWidth}
            onPointerDown={onResizePointerDown}
            className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none hover:bg-cyan-400/50"
          />
        ) : null}
      </aside>

      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ paddingLeft: isLg && desktopPinned ? sidebarWidth : 0 }}
      >
        <div className="border-dash-border bg-dash-header/90 supports-[backdrop-filter]:bg-dash-header/75 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
          <header className="flex items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3 lg:px-8">
            <button
              type="button"
              className="hover:bg-dash-muted focus-visible:ring-dash-accent inline-flex shrink-0 rounded-lg p-2 focus-visible:ring-2 focus-visible:outline-none"
              aria-expanded={sidebarVisible}
              aria-controls="dash-sidebar"
              aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
              onClick={toggleSidebar}
            >
              {sidebarVisible ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-dash-foreground truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
              <p className="text-dash-muted-foreground truncate text-sm">{subtitle}</p>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <AcademicYearSelect />
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} aria-hidden />
              <span className="text-dash-muted-foreground text-xs font-medium">Live data</span>
              <form action="/auth/signout" method="post" className="ml-2">
                <button
                  type="submit"
                  className="text-dash-muted-foreground hover:text-dash-foreground text-xs font-semibold underline-offset-2 hover:underline"
                >
                  Sign out
                </button>
              </form>
            </div>
          </header>

          {sidebarVisible ? null : (
            <nav
              aria-label="Main navigation"
              className="border-dash-border border-t px-4 py-2 lg:px-8"
            >
              <NavLinks
                pathname={pathname}
                layout="top"
                onNavigate={closeMobileDrawer}
                badges={navBadges}
              />
            </nav>
          )}

          {headerBelow ? (
            <div className="border-dash-border border-t bg-dash-header/60 px-4 py-2.5 lg:px-8">{headerBelow}</div>
          ) : null}
        </div>

        <div className="dash-grid-bg flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</div>
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
