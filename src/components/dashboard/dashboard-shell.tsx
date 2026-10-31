"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CompanyBrandBar } from "@/components/brand/company-brand-bar";
import { useMediaQuery } from "@/components/dashboard/use-media-query";

const STORAGE_PINNED = "dashSidebarPinned";
const STORAGE_WIDTH = "dashSidebarWidth";

type SidebarWidthKey = "narrow" | "default" | "wide";

const SIDEBAR_WIDTH: Record<
  SidebarWidthKey,
  { aside: string; mainPad: string; label: string }
> = {
  narrow: { aside: "w-56", mainPad: "lg:pl-56", label: "Narrow" },
  default: { aside: "w-64", mainPad: "lg:pl-64", label: "Default" },
  wide: { aside: "w-72", mainPad: "lg:pl-72", label: "Wide" },
};

type NavItem = {
  href: string;
  label: string;
  /** Custom active match; default is pathname === href or pathname.startsWith(href + "/") */
  isActive?: (pathname: string) => boolean;
};

type NavSection = { title: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    title: "Main",
    items: [
      { href: "/", label: "Workflow home", isActive: (p) => p === "/" },
      { href: "/about", label: "About", isActive: (p) => p === "/about" || p.startsWith("/about/") },
    ],
  },
  {
    title: "Projects",
    items: [
      {
        href: "/projects",
        label: "All projects",
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
        isActive: (p) => p === "/plans" || p.startsWith("/plans/"),
      },
      {
        href: "/clients",
        label: "Manage clients",
        isActive: (p) => p === "/clients" || p.startsWith("/clients/"),
      },
      {
        href: "/titles",
        label: "Project titles",
      },
    ],
  },
  {
    title: "Google Drive",
    items: [
      {
        href: "/drive",
        label: "Browse folders",
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
  const [widthKey, setWidthKey] = useState<SidebarWidthKey>("default");
  const pathname = usePathname();

  const sidebarVisible = isLg ? desktopPinned : mobileDrawerOpen;
  const width = SIDEBAR_WIDTH[widthKey];

  useEffect(() => {
    try {
      const pinned = localStorage.getItem(STORAGE_PINNED);
      if (pinned === "0") setDesktopPinned(false);
      const w = localStorage.getItem(STORAGE_WIDTH);
      if (w === "narrow" || w === "default" || w === "wide") setWidthKey(w);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

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
      localStorage.setItem(STORAGE_WIDTH, widthKey);
    } catch {
      /* ignore */
    }
  }, [widthKey, hydrated]);

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
        className={`border-dash-border bg-dash-sidebar text-dash-sidebar-muted fixed inset-y-0 left-0 z-50 flex ${width.aside} flex-col border-r shadow-xl transition-transform duration-200 ease-out ${
          sidebarVisible ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <CompanyBrandBar variant="compact" onNavigate={closeMobileDrawer} />

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3" aria-label="Main navigation">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="text-dash-sidebar-muted px-3 pb-2 text-[10px] font-semibold tracking-widest uppercase">
                {section.title}
              </p>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const active = itemActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={closeMobileDrawer}
                        className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-dash-accent/20 text-cyan-100 ring-1 ring-cyan-500/30"
                            : "hover:bg-dash-sidebar-hover text-dash-sidebar-muted hover:text-slate-50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-dash-border text-dash-sidebar-muted mt-auto space-y-3 border-t p-4 text-xs leading-relaxed">
          <div>
            <p className="text-dash-sidebar-muted mb-1.5 px-0.5 text-[10px] font-semibold tracking-widest uppercase">
              Sidebar width
            </p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(SIDEBAR_WIDTH) as SidebarWidthKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setWidthKey(key)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                    widthKey === key
                      ? "bg-dash-accent/25 text-cyan-100 ring-1 ring-cyan-500/35"
                      : "hover:bg-dash-sidebar-hover text-dash-sidebar-muted hover:text-slate-50"
                  }`}
                >
                  {SIDEBAR_WIDTH[key].label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-dash-sidebar-muted/90">
            Clients from invoices → <span className="font-medium text-slate-200">registered_clients</span>. Projects in{" "}
            <span className="font-medium text-slate-200">tracked_projects</span>.
          </p>
        </div>
      </aside>

      <div
        className={`flex min-w-0 flex-1 flex-col pl-0 transition-[padding] duration-200 ease-out ${
          isLg && desktopPinned ? width.mainPad : "lg:pl-0"
        }`}
      >
        <div className="border-dash-border bg-dash-header/90 supports-[backdrop-filter]:bg-dash-header/75 sticky top-0 z-30 shrink-0 border-b backdrop-blur-md">
          <header className="flex items-center gap-4 px-4 py-3 lg:px-8">
            <button
              type="button"
              className="hover:bg-dash-muted focus-visible:ring-dash-accent inline-flex rounded-lg p-2 focus-visible:ring-2 focus-visible:outline-none"
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

          {headerBelow ? (
            <div className="border-dash-border border-t bg-dash-header/60 px-4 py-2.5 lg:px-8">{headerBelow}</div>
          ) : null}
        </div>

        <div className="dash-grid-bg flex-1">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</div>
        </div>
      </div>
    </div>
  );
}
