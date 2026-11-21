"use client";

import { createContext, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { portalSignOutAction } from "@/app/portal/auth-actions";
import { GuestPreviewBanner } from "@/components/portal/guest-preview-banner";
import { LinkifiedText } from "@/components/portal/linkified-text";
import { PortalNavLinks } from "@/components/portal/portal-nav";
import { PlanModeChip } from "@/components/portal/plan-mode-chip";
import { SiteFooter } from "@/components/portal/site-footer";
import { TitleRules } from "@/components/portal/title-terms-gate";
import type { Course } from "@/lib/portal/data";
import { projectMark } from "@/lib/portal/project-mark";
import { titleCohortFromText, titleCohortKey } from "@/lib/portal/title-cohort";
import type { ReviewItem } from "@/lib/portal/title-choices";
import { hasActiveDeskPlan, MAX_TITLE_CHOICES } from "@/lib/portal/title-limits";
import {
  EMPTY_TITLE_LIST_FILTERS,
  parseTitleListFilters,
  pushTitleListFilters,
  TITLE_FILTER_ALL,
  TITLE_FILTER_NONE,
  titleDetailHref,
  type TitleListFilters,
} from "@/lib/portal/title-list-filters";

const LINE =
  "border-dash-foreground/30 text-dash-foreground placeholder:text-dash-muted-foreground w-full border-0 border-b bg-transparent px-0 py-2 text-sm outline-none focus:border-dash-accent";

type FrameValue = {
  items: ReviewItem[];
  mine: ReviewItem[];
  courseName: Map<string, string>;
  studentYear: string | null;
  readOnly: boolean;
  order: Map<string, number> | null;
  setOrder: (order: Map<string, number>) => void;
  filtering: boolean;
  matched: ReviewItem[];
  ordered: ReviewItem[];
  groups: [string, ReviewItem[]][];
  completedCount: number;
  proposalCount: number;
  listFilters: TitleListFilters;
};

const FrameContext = createContext<FrameValue | null>(null);

export function useTitlesFrame(): FrameValue {
  const value = useContext(FrameContext);
  if (!value) throw new Error("Titles frame is missing.");
  return value;
}

export function CohortTitleBoard(props: {
  items: ReviewItem[];
  mine: ReviewItem[];
  courses: Course[];
  studentYear: string | null;
  acceptedOn?: string | null;
  readOnly: boolean;
  guest?: boolean;
  viewer?: { name: string; detail: string | null; homeHref: string | null } | null;
  hasWorkspace?: boolean;
  hasProgress?: boolean;
  deskExpiresAt?: string | null;
}) {
  return (
    <TitlesFrame {...props} catalogueTools>
      <TitlesMainPanel />
    </TitlesFrame>
  );
}

export function TitlesFrame(props: Parameters<typeof TitlesFrameBody>[0]) {
  return (
    <Suspense fallback={<main className="bg-dash-canvas min-h-screen" aria-busy="true" />}>
      <TitlesFrameBody {...props} />
    </Suspense>
  );
}

function TitlesFrameBody({
  items,
  mine,
  courses,
  studentYear,
  acceptedOn,
  readOnly,
  guest = false,
  viewer,
  hasWorkspace = false,
  hasProgress = false,
  deskExpiresAt = null,
  catalogueTools = false,
  children,
}: {
  items: ReviewItem[];
  mine: ReviewItem[];
  courses: Course[];
  studentYear: string | null;
  acceptedOn?: string | null;
  readOnly: boolean;
  guest?: boolean;
  viewer?: { name: string; detail: string | null; homeHref: string | null } | null;
  hasWorkspace?: boolean;
  hasProgress?: boolean;
  deskExpiresAt?: string | null;
  /** Year / department / institution filters at the top of the titles side nav. */
  catalogueTools?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onListPage = pathname === "/portal/titles";
  const urlFilters = onListPage ? parseTitleListFilters(searchParams) : EMPTY_TITLE_LIST_FILTERS;
  const [order, setOrder] = useState<Map<string, number> | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [isLg, setIsLg] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setOrder(shuffle(items.map((item) => item.id))));
  }, [items]);
  const year = onListPage ? urlFilters.year : TITLE_FILTER_ALL;
  const institution = onListPage ? urlFilters.institution : TITLE_FILTER_ALL;
  const department = onListPage ? urlFilters.department : TITLE_FILTER_ALL;
  const level = onListPage ? urlFilters.level : TITLE_FILTER_ALL;
  const listFilters = onListPage ? urlFilters : parseTitleListFilters(searchParams);

  const setYear = (value: string) => {
    if (!onListPage) return;
    pushTitleListFilters(router, pathname, { ...urlFilters, year: value });
  };
  const setInstitution = (value: string) => {
    if (!onListPage) return;
    pushTitleListFilters(router, pathname, { ...urlFilters, institution: value });
  };
  const setDepartment = (value: string) => {
    if (!onListPage) return;
    pushTitleListFilters(router, pathname, { ...urlFilters, department: value });
  };
  const setLevel = (value: string) => {
    if (!onListPage) return;
    pushTitleListFilters(router, pathname, { ...urlFilters, level: value });
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsLg(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  const sidebarVisible = isLg || drawer;

  const courseName = useMemo(() => new Map(courses.map((course) => [course.code, course.name])), [courses]);
  const years = unique(items.map((item) => item.yearLabel));
  const institutions = unique(items.map((item) => item.institution));
  const departments = unique(items.map((item) => item.courseCode));
  const levelOptions = (() => {
    const byKey = new Map<string, string>();
    for (const item of items) {
      const cohort = titleCohortFromText(item.batch, item.source);
      if (cohort) byKey.set(cohort.key, cohort.label);
    }
    return [...byKey.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  })();
  const missingInstitution = items.some((item) => !item.institution);
  const slotsLeft = MAX_TITLE_CHOICES - mine.length;
  const filtering =
    year !== TITLE_FILTER_ALL || institution !== TITLE_FILTER_ALL || department !== TITLE_FILTER_ALL || level !== TITLE_FILTER_ALL;

  const matched = items.filter((item) => {
    if (year !== TITLE_FILTER_ALL && item.yearLabel !== year) return false;
    if (department !== TITLE_FILTER_ALL && item.courseCode !== department) return false;
    if (
      institution === TITLE_FILTER_NONE
        ? Boolean(item.institution)
        : institution !== TITLE_FILTER_ALL && item.institution !== institution
    )
      return false;
    if (level !== TITLE_FILTER_ALL) {
      const itemLevel = titleCohortKey(item.batch, item.source);
      if (itemLevel !== level) return false;
    }
    return true;
  });

  const ordered = order ? [...matched].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) : [];
  // Keep year sections when filtering, but honor shuffle order inside each year.
  const groups = filtering
    ? groupByYear(matched).map(([label, group]): [string, ReviewItem[]] => [
        label,
        order
          ? [...group].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
          : group,
      ])
    : [];
  const siteYears = yearFromTo(items);
  const completedCount = matched.filter((item) => item.kind === "earlier").length;
  const proposalCount = matched.filter((item) => item.kind === "study").length;

  function clearFilters() {
    if (!onListPage) return;
    router.replace("/portal/titles", { scroll: false });
  }

  const field =
    "w-full border-0 border-b border-white/25 bg-transparent px-0 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-dash-accent";
  const labelTone = "text-white/55";

  /** Titles page side nav: Filter → Selected titles → (portal links follow in PortalNavLinks). */
  const catalogueTop = catalogueTools ? (
    <div className="border-white/10 space-y-5 border-t pt-5">
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3 px-3">
          <h2 className="text-sm font-semibold text-white">Filter by</h2>
          {filtering ? (
            <button type="button" onClick={clearFilters} className="text-xs font-semibold text-white underline">
              Clear
            </button>
          ) : null}
        </div>
        <div className="space-y-3 px-3">
          <Filter
            label="Year"
            value={year}
            onChange={setYear}
            fieldClass={field}
            labelClass={labelTone}
            options={[
              { value: TITLE_FILTER_ALL, label: "All years" },
              ...years.map((value) => ({
                value,
                label: `${yearSpan(value)}${studentYear && value < studentYear ? " · before your year" : ""}`,
              })),
            ]}
          />
          <Filter
            label="Department"
            value={department}
            onChange={setDepartment}
            fieldClass={field}
            labelClass={labelTone}
            options={[
              { value: TITLE_FILTER_ALL, label: "All departments" },
              ...departments.map((code) => ({ value: code, label: courseName.get(code) ?? code })),
            ]}
          />
          <Filter
            label="Institution"
            value={institution}
            onChange={setInstitution}
            fieldClass={field}
            labelClass={labelTone}
            options={[
              { value: TITLE_FILTER_ALL, label: "All institutions" },
              ...(missingInstitution ? [{ value: TITLE_FILTER_NONE, label: "Not recorded" }] : []),
              ...institutions.map((value) => ({ value, label: value })),
            ]}
          />
          <Filter
            label="Level"
            value={level}
            onChange={setLevel}
            fieldClass={field}
            labelClass={labelTone}
            options={[
              { value: TITLE_FILTER_ALL, label: "All levels" },
              ...levelOptions,
            ]}
          />
        </div>
      </section>

      {!readOnly ? (
        <section className="px-3">
          <h2 className="text-sm font-semibold text-white">Titles selected</h2>
          {mine.length ? (
            <ul className="mt-3 space-y-2">
              {mine.map((item) => (
                <li key={item.id}>
                  <Link
                    href={titleDetailHref(item.id, listFilters)}
                    className="text-sm leading-snug font-medium text-white hover:underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-white/60">None selected yet.</p>
          )}
        </section>
      ) : null}
    </div>
  ) : null;

  const policyOpen = onListPage && searchParams.get("view") === "policy";
  const catalogueExtras = catalogueTools ? (
    <div className="border-white/10 border-t pt-5">
      <Link
        href="/portal/titles?view=policy"
        prefetch
        aria-current={policyOpen ? "page" : undefined}
        onClick={() => setDrawer(false)}
        className={`mx-3 block rounded-lg px-3 py-2 text-sm font-medium ${
          policyOpen ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
        }`}
      >
        Policy and rules
      </Link>
    </div>
  ) : null;

  const titleBand = (
    <div className="flex min-h-[3.6rem] flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:h-[4.25rem] sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-0">
      <button
        type="button"
        className="hover:bg-dash-muted focus-visible:ring-dash-accent inline-flex shrink-0 rounded-lg p-2 focus-visible:ring-2 focus-visible:outline-none lg:hidden"
        aria-expanded={drawer}
        aria-controls="portal-side-nav"
        aria-label={drawer ? "Hide sidebar" : "Show sidebar"}
        onClick={() => setDrawer((open) => !open)}
      >
        {drawer ? <SidebarCloseIcon /> : <SidebarOpenIcon />}
      </button>
      <div className="min-w-0 flex-1 basis-[10rem]">
        <p className="text-dash-foreground flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-semibold tracking-tight tabular-nums sm:text-xl">{items.length}</span>
          <span className="text-dash-muted-foreground text-[11px] sm:text-sm">titles on this site</span>
        </p>
        <p className="text-dash-muted-foreground mt-0.5 max-w-xl truncate text-[10px] leading-relaxed sm:text-xs">
          {siteYears.startsWith("from ") ? `These are project titles collected ${siteYears}.` : "These are project titles collected for this site."}
        </p>
      </div>
      <div className="border-dash-border ml-auto flex shrink-0 flex-wrap items-center justify-end gap-0.5 border-l pl-2 sm:gap-1 sm:pl-3">
        {!readOnly ? <PlanModeChip deskExpiresAt={deskExpiresAt} compact /> : null}
        {viewer?.homeHref ? (
          <Link href={viewer.homeHref} className="text-dash-muted-foreground hover:bg-dash-muted hover:text-dash-foreground inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold sm:px-2.5">
            <HomeIcon />
            <span className="hidden sm:inline">Home</span>
          </Link>
        ) : null}
        <div ref={accountRef} className="relative">
          <button
            type="button"
            className="text-dash-foreground hover:bg-dash-muted inline-flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 sm:pr-2"
            aria-expanded={accountOpen}
            aria-label="Account"
            onClick={() => setAccountOpen((open) => !open)}
          >
            <span className="bg-dash-foreground inline-flex h-8 w-8 items-center justify-center rounded-full text-white">
              <AccountIcon />
            </span>
            <span className="hidden max-w-[6rem] truncate text-xs font-medium sm:inline sm:max-w-[11rem]">{viewer?.name ?? "Account"}</span>
          </button>
          {accountOpen ? (
            <div className="bg-dash-card text-dash-foreground border-dash-border absolute top-full right-0 z-20 mt-2 w-64 rounded-lg border p-3 shadow-sm">
              <p className="text-sm font-semibold">{viewer?.name ?? "Account"}</p>
              {viewer?.detail ? <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">{viewer.detail}</p> : null}
              {!readOnly ? (
                <p className="text-dash-muted-foreground mt-2 text-xs">
                  {mine.length} shortlisted · {mine.filter((t) => t.isHiddenFromPeers).length} hidden from classmates.
                  {slotsLeft ? " Select free; hide when you need conflict protection." : " Shortlist limit reached."}
                </p>
              ) : (
                <p className="text-dash-muted-foreground mt-2 text-xs">
                  {guest ? "Preview only — sign in to shortlist or claim." : "You can read every title."}
                </p>
              )}
              {acceptedOn ? <p className="text-dash-muted-foreground mt-1 text-xs">Rules accepted {acceptedOn}</p> : null}
              {!readOnly ? (
                <Link href="/portal/home?tab=projects" className="text-dash-accent mt-3 inline-block text-xs font-semibold">
                  My projects & titles
                </Link>
              ) : guest ? (
                <Link href="/portal?auth=signin" className="text-dash-accent mt-3 inline-block text-xs font-semibold">
                  Sign in to use →
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        {guest ? (
          <Link
            href="/portal?auth=signin"
            className="bg-dash-accent inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            Sign in
          </Link>
        ) : (
          <form action={portalSignOutAction}>
            <button
              type="submit"
              className="text-dash-muted-foreground hover:bg-dash-muted hover:text-dash-foreground inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            >
              <LogoutIcon />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const frame: FrameValue = {
    items,
    mine,
    courseName,
    studentYear,
    readOnly,
    order,
    setOrder,
    filtering,
    matched,
    ordered,
    groups,
    completedCount,
    proposalCount,
    listFilters,
  };

  return (
    <FrameContext.Provider value={frame}>
    <div className="bg-dash-canvas text-dash-foreground min-h-screen overflow-x-hidden">
      <button
        type="button"
        aria-label="Close menu"
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden ${drawer ? "" : "hidden"}`}
        onClick={() => setDrawer(false)}
      />

      <aside
        id="portal-side-nav"
        aria-hidden={sidebarVisible ? undefined : true}
        inert={!sidebarVisible ? true : undefined}
        className={`bg-dash-sidebar fixed inset-y-0 left-0 z-50 flex w-[17rem] -translate-x-full flex-col overflow-y-auto pb-5 shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ${drawer ? "max-lg:translate-x-0" : "max-lg:pointer-events-none"}`}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) setDrawer(false);
        }}
      >
        <Suspense fallback={<div className="px-3 text-sm text-white/60">Loading…</div>}>
          <PortalNavLinks
            hasWorkspace={hasWorkspace}
            hasProgress={hasProgress}
            hasPaidDesk={!guest && hasActiveDeskPlan(deskExpiresAt)}
            onSide
            showSignOut={!guest}
            topExtras={catalogueTop}
            extras={catalogueExtras}
          />
        </Suspense>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[17rem]">
        <header
          className={`border-dash-border bg-dash-card/95 supports-[backdrop-filter]:bg-dash-card/80 fixed top-0 right-0 left-0 z-30 border-b backdrop-blur-md transition-shadow duration-300 lg:left-[17rem] ${
            scrolled ? "shadow-[0_8px_24px_-16px_rgba(15,23,42,0.55)]" : ""
          }`}
        >
          {titleBand}
          <span
            aria-hidden
            className={`bg-dash-accent pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-500 ${scrolled ? "scale-x-100" : "scale-x-0"}`}
          />
        </header>
        <div className="h-[3.6rem] shrink-0 sm:h-[4.25rem]" aria-hidden />

        <div className="min-w-0 flex-1 overflow-visible">
          {guest ? (
            <div className="px-3 pt-4 sm:px-6 lg:px-8">
              <GuestPreviewBanner blurb="Browse every title and open a brief. Sign in to shortlist, claim ownership, or open source documents." />
            </div>
          ) : null}
          {children}
        </div>
        <SiteFooter className="lg:pl-0" />
      </div>
    </div>
    </FrameContext.Provider>
  );
}

function TitlesMainPanel() {
  const searchParams = useSearchParams();
  if (searchParams.get("view") === "policy") {
    return <TitlePolicyPanel />;
  }
  return <TitleCatalogue />;
}

function TitlePolicyPanel() {
  return (
    <div className="mx-3 mb-10 sm:mx-8">
      <div className="border-dash-border bg-dash-card rounded-lg border p-4 sm:p-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-dash-foreground text-xl font-semibold tracking-tight">Policy and rules</h2>
          <Link href="/portal/titles" className="text-dash-accent text-sm font-semibold">
            ← Back to titles
          </Link>
        </div>
        <TitleRules />
      </div>
    </div>
  );
}

function TitleCatalogue() {
  const { items, courseName, studentYear, order, setOrder, filtering, matched, ordered, groups, completedCount, proposalCount } =
    useTitlesFrame();
  const [showEarlier, setShowEarlier] = useState(true);
  const [showStudy, setShowStudy] = useState(true);

  const visible = (item: ReviewItem) => (item.kind === "earlier" ? showEarlier : showStudy);
  const visibleMatched = matched.filter(visible);
  const visibleOrdered = ordered.filter(visible);
  const visibleGroups = groups
    .map(([label, group]): [string, ReviewItem[]] => [label, group.filter(visible)])
    .filter(([, group]) => group.length > 0);

  const list =
    matched.length === 0 ? (
      <p className="text-dash-muted-foreground py-8 text-sm">Nothing matches. Clear the filters to see every title.</p>
    ) : !showEarlier && !showStudy ? (
      <p className="text-dash-muted-foreground py-8 text-sm">Both categories are hidden. Use the eye icons above to show them again.</p>
    ) : visibleMatched.length === 0 ? (
      <p className="text-dash-muted-foreground py-8 text-sm">Nothing to show in the categories you left visible.</p>
    ) : !filtering && !order ? (
      <p className="text-dash-muted-foreground py-8 text-sm">Mixing the titles.</p>
    ) : filtering ? (
      <div>
        {visibleGroups.map(([label, group]) => (
          <section key={label} className="mt-8 first:mt-0">
            <h2 className="text-dash-foreground flex items-baseline justify-between gap-4 border-b border-dash-border pb-2 text-sm font-semibold">
              <span>
                {yearSpan(label)}
                {studentYear && label < studentYear ? <span className="text-dash-muted-foreground ml-3 font-normal">Before your year</span> : null}
              </span>
              <span className="text-dash-muted-foreground tabular-nums">{group.length}</span>
            </h2>
            <ul>
              {group.map((item) => (
                <TitleRow key={item.id} item={item} courseName={courseName} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    ) : (
      <ul>
        {visibleOrdered.map((item) => (
          <TitleRow key={item.id} item={item} courseName={courseName} />
        ))}
      </ul>
    );

  return (
    <>
      <div className="mx-3 mt-4 mb-4 sm:mx-8 sm:mt-5 sm:mb-5">
        <div className="border-dash-border bg-dash-card flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-stretch sm:gap-0 sm:px-5">
          <div className="grid min-w-0 flex-1 gap-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <CategoryCard
              count={completedCount}
              label="Final year projects"
              detail="Real student projects completed at Tanzanian institutes (2018–2026). See what your peers built and use them as references for your own work."
              visible={showEarlier}
              onToggle={() => setShowEarlier((v) => !v)}
              hideLabel="Hide final year projects"
              showLabel="Show final year projects"
            />
            <div className="border-dash-border my-3 border-t sm:mx-4 sm:my-0 sm:border-t-0 sm:border-l" aria-hidden />
            <CategoryCard
              count={proposalCount}
              label="New project titles"
              detail="Project ideas from global sources and open repositories. Browse, pick what interests you, and customize the topic to fit your skills and course."
              visible={showStudy}
              onToggle={() => setShowStudy((v) => !v)}
              hideLabel="Hide new project titles"
              showLabel="Show new project titles"
            />
          </div>
          <button
            type="button"
            onClick={() => setOrder(shuffle(matched.map((item) => item.id)))}
            className="text-dash-foreground w-full shrink-0 rounded-lg border border-current px-3 py-2 text-xs font-semibold sm:ml-4 sm:w-auto sm:self-center sm:py-1.5"
          >
            Shuffle
          </button>
        </div>
        {filtering ? (
          <p className="text-dash-muted-foreground mt-2 text-xs leading-relaxed">
            Filter match: <span className="text-dash-foreground font-semibold tabular-nums">{matched.length}</span>
            {" · "}
            <span className="tabular-nums">{completedCount}</span> final year
            {" · "}
            <span className="tabular-nums">{proposalCount}</span> new titles
            {!showStudy ? (
              <span className="text-amber-700 dark:text-amber-300"> — new project titles are hidden (use the eye icon).</span>
            ) : null}
            {!showEarlier ? (
              <span className="text-amber-700 dark:text-amber-300"> — final year projects are hidden (use the eye icon).</span>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="px-3 pb-6 sm:px-8">{list}</div>
    </>
  );
}

function CategoryCard({
  count,
  label,
  detail,
  visible,
  onToggle,
  hideLabel,
  showLabel,
}: {
  count: number;
  label: string;
  detail: string;
  visible: boolean;
  onToggle: () => void;
  hideLabel: string;
  showLabel: string;
}) {
  return (
    <div className={`min-w-0 py-0.5 ${visible ? "" : "opacity-55"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-dash-foreground text-sm">
          <span className="text-lg font-semibold tabular-nums">{count}</span>
          <span className="ml-2 font-medium">{label}</span>
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={!visible}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
          className="text-dash-muted-foreground hover:bg-dash-muted hover:text-dash-foreground inline-flex shrink-0 rounded-md p-1.5"
        >
          {visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
      <p className="text-dash-muted-foreground mt-0.5 text-xs leading-relaxed">{detail}</p>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .638C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m13.5 13.5L21 21m-4.5-4.5L21 21"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 9.88a3 3 0 104.24 4.24" />
    </svg>
  );
}

function SidebarCloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
    </svg>
  );
}

function SidebarOpenIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
  fieldClass = LINE,
  labelClass = "text-dash-muted-foreground",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  fieldClass?: string;
  labelClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = options.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const placeCard = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 220 && rect.top > spaceBelow) {
        setPlace({ bottom: window.innerHeight - rect.top + 8, left, width });
      } else {
        setPlace({ top: rect.bottom + 8, left, width });
      }
    };
    placeCard();
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-filter-card]")) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", placeCard);
    window.addEventListener("scroll", placeCard, true);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", placeCard);
      window.removeEventListener("scroll", placeCard, true);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      <span className={`${labelClass} font-mono text-[11px] tracking-[0.14em] uppercase`}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className={`${fieldClass} flex items-center justify-between gap-3 text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((next) => !next)}
      >
        <span className="truncate">{current}</span>
        <svg className="h-4 w-4 shrink-0 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && place
        ? createPortal(
            <div
              data-filter-card
              role="listbox"
              aria-label={label}
              style={{ position: "fixed", top: place.top, bottom: place.bottom, left: place.left, width: place.width, zIndex: 70 }}
              className="bg-dash-card text-dash-foreground border-dash-border max-h-64 overflow-y-auto rounded-lg border shadow-lg"
            >
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`hover:bg-dash-muted block w-full border-b border-dash-border px-3 py-2 text-left text-sm break-words last:border-b-0 ${selected ? "bg-dash-muted font-medium" : ""}`}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function AccountIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.25a7.5 7.5 0 0115 0" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 8.25V6A2.25 2.25 0 0013.5 3.75h-6A2.25 2.25 0 005.25 6v12A2.25 2.25 0 007.5 20.25h6A2.25 2.25 0 0015.75 18v-2.25M18 12H9m0 0l2.25-2.25M9 12l2.25 2.25" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 10.5L12 3.75l8.25 6.75V20.25a.75.75 0 01-.75.75h-5.25v-6h-4.5v6H4.5a.75.75 0 01-.75-.75V10.5z" />
    </svg>
  );
}

function yearSpan(label: string): string {
  const match = /^(20\d{2})\/(20\d{2})$/.exec(label);
  if (!match) return label;
  return `30 Sep ${match[1]} – 29 Sep ${match[2]}`;
}

function yearFromTo(list: ReviewItem[]): string {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const item of list) {
    const match = /^(20\d{2})\/(20\d{2})$/.exec(item.yearLabel);
    if (!match) continue;
    starts.push(Number(match[1]));
    ends.push(Number(match[2]));
  }
  if (!starts.length) return list.length ? "Year not recorded" : "";
  return `from ${Math.min(...starts)} to ${Math.max(...ends)}`;
}

function emptyProblem(item: ReviewItem): string {
  if (item.problemStatement) return item.problemStatement;
  if (item.summary) return item.summary;
  return "No problem statement has been published yet for this title.";
}

function TitleRow({ item, courseName }: { item: ReviewItem; courseName: Map<string, string> }) {
  const { listFilters } = useTitlesFrame();
  const [open, setOpen] = useState(false);
  const mark = projectMark(item);
  const courseFull = mark.courseCode ? (courseName.get(mark.courseCode) ?? mark.courseCode) : null;
  return (
    <li className="border-dash-foreground/15 border-b py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-dash-muted-foreground text-[11px] leading-relaxed tracking-wide break-words uppercase">
            <span>{mark.year}</span>
            <span aria-hidden="true"> | </span>
            <span>{mark.group}</span>
            {mark.courseCode ? (
              <>
                <span aria-hidden="true"> | </span>
                <span className="lg:hidden">{mark.courseCode}</span>
                <span className="hidden lg:inline">{courseFull}</span>
              </>
            ) : null}
            {mark.institute ? (
              <>
                <span aria-hidden="true"> | </span>
                <span className="break-words">{mark.institute}</span>
              </>
            ) : null}
          </p>
          <p className="text-dash-foreground mt-1 text-base leading-snug font-semibold break-words sm:text-lg">{item.title}</p>
          {item.batch ? <p className="text-dash-muted-foreground mt-1 text-xs break-words">{item.batch}</p> : null}
          <p className="text-dash-muted-foreground mt-1 text-xs break-words">{mark.citation}</p>
          <p className="mt-2 text-xs leading-relaxed text-blue-950 italic dark:text-blue-300">{mark.note}</p>
          {open ? (
            <div className="border-dash-border mt-3 space-y-3 rounded-lg border px-3 py-3">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Problem statement</p>
                <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
                  <LinkifiedText text={emptyProblem(item)} />
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Main objective</p>
                <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
                  <LinkifiedText text={item.objectives ?? "No main objective has been published yet for this title."} />
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Specific objectives</p>
                <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
                  <LinkifiedText
                    text={item.specificObjectives ?? "Open the title page — extracted from the source document when available."}
                  />
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Recommendations</p>
                <p className="text-dash-muted-foreground mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
                  <LinkifiedText
                    text={item.limitations ?? "Open the title page — extracted from the source document when available."}
                  />
                </p>
              </div>
              {item.sourceUrl ? (
                <Link
                  href={`${titleDetailHref(item.id, listFilters)}#documents`}
                  className="text-dash-accent inline-block text-sm font-semibold"
                >
                  Source file on title page (unlock to view)
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
          <Link
            href={titleDetailHref(item.id, listFilters)}
            className="text-dash-foreground border-b border-current text-sm font-semibold"
          >
            Select
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-dash-muted-foreground border-b border-current text-sm font-semibold"
            aria-expanded={open}
          >
            {open ? "Hide" : "Read"}
          </button>
        </div>
      </div>
    </li>
  );
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function shuffle(ids: string[]): Map<string, number> {
  const copy = [...ids];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return new Map(copy.map((id, index) => [id, index]));
}

function groupByYear(items: ReviewItem[]): [string, ReviewItem[]][] {
  const groups = new Map<string, ReviewItem[]>();
  for (const item of items) {
    const list = groups.get(item.yearLabel) ?? [];
    list.push(item);
    groups.set(item.yearLabel, list);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "Year not recorded") return 1;
    if (b === "Year not recorded") return -1;
    return b.localeCompare(a);
  });
}
