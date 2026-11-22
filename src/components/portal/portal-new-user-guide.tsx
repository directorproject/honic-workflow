"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useState, useTransition } from "react";

import { portalCompleteProductGuideAction } from "@/app/portal/actions";
import {
  PORTAL_GUIDE_FINISH_HREF,
  PORTAL_GUIDE_STORAGE_KEY,
} from "@/lib/portal/product-guide";

export {
  PORTAL_GUIDE_FINISH_HREF,
  PORTAL_GUIDE_STORAGE_KEY,
} from "@/lib/portal/product-guide";

type Placement = "auto" | "center" | "bottom" | "right" | "left";

type Step = {
  id: string;
  title: string;
  body: string;
  target?: string;
  placement?: Placement;
  openMenu?: boolean;
  closeMenu?: boolean;
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Welcome to Honic Nexis",
    body: "A short walkthrough of your side menu. We’ll highlight each section while the rest of the page stays blurred.",
    placement: "center",
  },
  {
    id: "menu",
    title: "Open the menu",
    body: "On phones, tap here to open the side menu. On large screens it stays open already.",
    target: "[data-tour='portal-menu']",
    placement: "bottom",
  },
  {
    id: "workspace",
    title: "Workspace",
    body: "Your project home. Open Home anytime to see where you left off and jump back into your desk.",
    target: "[data-tour='portal-nav-workspace']",
    placement: "right",
    openMenu: true,
  },
  {
    id: "plan-section",
    title: "Plan",
    body: "Schedule the project: Gantt chart, Calendar, and Field study. Use these to map deadlines and site work.",
    target: "[data-tour='portal-nav-plan']",
    placement: "right",
    openMenu: true,
  },
  {
    id: "work",
    title: "Work",
    body: "Where the project lives day to day — Review documents and Project files for drafts, feedback, and uploads.",
    target: "[data-tour='portal-nav-work']",
    placement: "right",
    openMenu: true,
  },
  {
    id: "team",
    title: "Team & supervisor",
    body: "Invite partners and connect your supervisor. Share progress and keep everyone on the same project.",
    target: "[data-tour='portal-nav-team']",
    placement: "right",
    openMenu: true,
  },
  {
    id: "peer-help",
    title: "Peer help",
    body: "What it is: a board where students hire each other. Post a paid job (coding, wiring, printing, writing) or apply to help someone and get paid. Anyone can browse; posting and chat need a paid Desk plan.",
    target: "[data-tour='portal-nav-peer-help']",
    placement: "right",
    openMenu: true,
  },
  {
    id: "zimamoto",
    title: "Zimamoto",
    body: "What it is: student groups and open posts. Join a group chat, share progress, or read public posts from other students — a simple campus board inside Nexis.",
    target: "[data-tour='portal-nav-zimamoto']",
    placement: "right",
    openMenu: true,
  },
  {
    id: "literature",
    title: "Literature review",
    body: "What it is: the title catalogue. Browse ideas for your course, select one free to keep it yours on the list, then hide it so classmates at your college, course, and level cannot pick the same title.",
    target: "[data-tour='portal-nav-literature']",
    placement: "right",
    openMenu: true,
  },
  {
    id: "help-desk",
    title: "Help desk",
    body: "What it is: direct chat with Honic staff. Ask about your project, payments, titles, or Desk access when you need support.",
    target: "[data-tour='portal-nav-help-desk']",
    placement: "right",
    openMenu: true,
  },
  {
    id: "you",
    title: "You",
    body: "Your account area — projects & titles you hold, payments, account details, and Plans & access.",
    target: "[data-tour='portal-nav-you']",
    placement: "right",
    openMenu: true,
  },
  {
    id: "finish",
    title: "You’re ready",
    body: "Next you’ll land on Plans. Free browsing stays available; Nexis Desk unlocks workspace tools, peer help actions, and title hides.",
    placement: "center",
    closeMenu: true,
  },
];

const PAD = 10;
const EDGE = 12;
/** Phones / small tablets: dock the tip card to the bottom so it never clips. */
const NARROW_MAX = 768;

type Rect = { top: number; left: number; width: number; height: number };
type TipPos =
  | { mode: "bottom" }
  | { mode: "float"; top: number; left: number; width: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function readTargetRect(selector: string | undefined): Rect | null {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return null;
  // Keep the target in the upper half on phones so the bottom tip card does not cover it.
  const narrow = window.innerWidth < NARROW_MAX;
  el.scrollIntoView({ block: narrow ? "center" : "nearest", inline: "nearest" });
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function shouldShowPortalGuide(searchGuide: string | null, searchNav: string | null): boolean {
  return searchGuide === "1" || searchNav === "1";
}

export function PortalNewUserGuide({
  open,
  required = false,
  onOpenMenu,
  onCloseMenu,
  onDismiss,
}: {
  open: boolean;
  /** When true, every step must be completed — no skip, and finish is saved on the account. */
  required?: boolean;
  onOpenMenu?: () => void;
  onCloseMenu?: () => void;
  /** Called when the tour finishes (parent can clear sticky open state). */
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(open);
  const [hole, setHole] = useState<Rect | null>(null);
  const [tip, setTip] = useState<TipPos | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const current = STEPS[step] ?? STEPS[0]!;
  const isLast = step >= STEPS.length - 1;

  const measure = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const narrow = vw < NARROW_MAX;

    let rect = readTargetRect(current.target);
    // Desktop has no hamburger — fall through to side nav for that step.
    if (!rect && current.id === "menu") {
      rect = readTargetRect("[data-tour='portal-nav']");
    }
    // If a nav group isn't mounted yet, spotlight the whole side nav.
    if (!rect && current.target?.startsWith("[data-tour='portal-nav-")) {
      rect = readTargetRect("[data-tour='portal-nav']");
    }

    // Clamp spotlight to the visible viewport (drawer targets can sit partly off-screen).
    if (rect) {
      const left = clamp(rect.left, 0, vw);
      const top = clamp(rect.top, 0, vh);
      const width = clamp(rect.width, 0, vw - left);
      const height = clamp(rect.height, 0, vh - top);
      setHole(width >= 2 && height >= 2 ? { top, left, width, height } : null);
    } else {
      setHole(null);
    }

    // Phones: always dock the card to the bottom so it never clips sideways.
    if (narrow) {
      setTip({ mode: "bottom" });
      return;
    }

    const cardW = Math.min(340, vw - EDGE * 2);
    const cardH = 210;

    if (!rect || current.placement === "center") {
      setTip({
        mode: "float",
        top: Math.max(EDGE, (vh - cardH) / 2),
        left: Math.max(EDGE, (vw - cardW) / 2),
        width: cardW,
      });
      return;
    }

    let top = rect.top + rect.height + PAD + 10;
    let left = rect.left + rect.width / 2 - cardW / 2;
    const place = current.placement ?? "auto";

    if (place === "right") {
      top = Math.max(EDGE, rect.top + 4);
      left = rect.left + rect.width + PAD + 12;
      // Not enough room on the right → flip below or left.
      if (left + cardW > vw - EDGE) {
        if (rect.left - cardW - PAD - 12 >= EDGE) {
          left = rect.left - cardW - PAD - 12;
        } else {
          left = Math.max(EDGE, (vw - cardW) / 2);
          top = rect.top + rect.height + PAD + 10;
          if (top + cardH > vh - EDGE) top = Math.max(EDGE, rect.top - cardH - PAD - 10);
        }
      }
    } else if (place === "left") {
      top = Math.max(EDGE, rect.top);
      left = rect.left - cardW - PAD - 12;
      if (left < EDGE) {
        left = Math.max(EDGE, (vw - cardW) / 2);
        top = rect.top + rect.height + PAD + 10;
      }
    } else if (place === "bottom" || place === "auto") {
      if (top + cardH > vh - EDGE) {
        top = Math.max(EDGE, rect.top - cardH - PAD - 10);
      }
    }

    left = clamp(left, EDGE, vw - cardW - EDGE);
    top = clamp(top, EDGE, vh - cardH - EDGE);
    setTip({ mode: "float", top, left, width: cardW });
  }, [current]);

  useEffect(() => {
    setVisible(open);
    if (open) {
      setStep(0);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!visible) return;
    if (current.openMenu) onOpenMenu?.();
    if (current.closeMenu) onCloseMenu?.();
    // Drawer slide needs a beat longer on phones before measuring the spotlight.
    const delay = current.openMenu ? (window.innerWidth < NARROW_MAX ? 360 : 280) : 50;
    const t = window.setTimeout(measure, delay);
    return () => window.clearTimeout(t);
  }, [visible, step, current, measure, onOpenMenu, onCloseMenu]);

  useLayoutEffect(() => {
    if (!visible) return;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [visible, measure]);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible) return null;

  function finish() {
    setError(null);
    startTransition(async () => {
      try {
        localStorage.setItem(PORTAL_GUIDE_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      if (required) {
        const res = await portalCompleteProductGuideAction();
        if (!res.ok) {
          setError(res.message || "Could not save. Try again.");
          return;
        }
      }
      onCloseMenu?.();
      setVisible(false);
      onDismiss?.();
      router.replace(PORTAL_GUIDE_FINISH_HREF);
    });
  }

  function next() {
    if (isLast) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const spot = hole
    ? {
        top: clamp(hole.top - PAD, 0, vh),
        left: clamp(hole.left - PAD, 0, vw),
        width: clamp(hole.width + PAD * 2, 0, Math.max(0, vw - Math.max(0, hole.left - PAD))),
        height: clamp(hole.height + PAD * 2, 0, Math.max(0, vh - Math.max(0, hole.top - PAD))),
      }
    : null;

  const dim = "bg-slate-950/55 backdrop-blur-sm";
  const cardBottom = tip?.mode === "bottom";
  const cardFloat = tip?.mode === "float" ? tip : null;

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Four-panel blur shade — cut-out stays sharp and interactive */}
      {spot ? (
        <>
          <div className={`absolute ${dim}`} style={{ top: 0, left: 0, right: 0, height: spot.top }} />
          <div
            className={`absolute ${dim}`}
            style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className={`absolute ${dim}`}
            style={{ top: spot.top, left: 0, width: spot.left, height: spot.height }}
          />
          <div
            className={`absolute ${dim}`}
            style={{
              top: spot.top,
              left: spot.left + spot.width,
              right: 0,
              height: spot.height,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-xl ring-2 ring-cyan-300 shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_28px_rgba(34,211,238,0.45)] transition-all duration-300"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
            }}
          />
        </>
      ) : (
        <div className={`absolute inset-0 ${dim}`} />
      )}

      <div
        className={`border-dash-border bg-dash-card text-dash-foreground z-[82] rounded-2xl border shadow-[0_20px_50px_-20px_rgba(15,23,42,0.75)] transition-all duration-300 ${
          cardBottom
            ? "fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 max-h-[min(46vh,22rem)] overflow-y-auto"
            : "fixed max-w-[calc(100vw-1.5rem)]"
        }`}
        style={
          cardFloat
            ? {
                top: cardFloat.top,
                left: cardFloat.left,
                width: cardFloat.width,
              }
            : undefined
        }
      >
        <div className="px-3.5 pt-3.5 pb-3 sm:px-4 sm:pt-4">
          <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-3">
            <p className="text-dash-accent shrink-0 text-[10px] font-semibold tracking-[0.2em] uppercase">
              {required ? "Required tour" : "Tour"}
            </p>
            <div
              className="flex max-w-[55%] flex-wrap items-center justify-end gap-1"
              aria-label={`Step ${step + 1} of ${STEPS.length}`}
            >
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "bg-dash-accent w-3.5 sm:w-4" : i < step ? "bg-dash-accent/50 w-1.5" : "bg-dash-border w-1.5"
                  }`}
                />
              ))}
            </div>
          </div>
          <h2 id={titleId} className="text-base font-semibold tracking-tight sm:text-lg">
            {current.title}
          </h2>
          <p className="text-dash-muted-foreground mt-1.5 text-sm leading-relaxed">{current.body}</p>
          {error ? <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-300">{error}</p> : null}
        </div>

        <div className="border-dash-border flex items-center justify-between gap-2 border-t px-3 py-2.5">
          {required ? (
            <p className="text-dash-muted-foreground px-1 text-[11px] font-medium sm:px-2">
              Step {step + 1} of {STEPS.length}
            </p>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={pending}
              className="text-dash-muted-foreground hover:text-dash-foreground px-2 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              Skip
            </button>
          )}
          <div className="flex shrink-0 gap-1.5">
            {step > 0 ? (
              <button
                type="button"
                onClick={back}
                disabled={pending}
                className="border-dash-border text-dash-foreground inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={next}
              disabled={pending}
              className="bg-dash-accent inline-flex items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : isLast ? "Go to plans" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
