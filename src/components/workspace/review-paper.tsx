"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { BTN, BTN_GHOST, BTN_SOFT, INPUT } from "@/components/workspace/ws-ui";
import { loadPdfJs } from "@/lib/workspace/pdfjs";
import type { ReviewMark, ReviewStroke } from "@/lib/workspace/types";

/** Desktop ribbon: sharp corners, no button borders or divider lines. */
const TB =
  "inline-flex h-7 items-center justify-center rounded-none border-0 px-2.5 text-xs font-semibold transition disabled:opacity-40";
const TB_ON = `${TB} bg-dash-accent text-white`;
const TB_OFF = `${TB} text-dash-muted-foreground hover:bg-dash-muted hover:text-dash-foreground`;
const TB_ICON = `${TB} min-w-7 px-1.5 text-dash-muted-foreground hover:bg-dash-muted hover:text-dash-foreground`;
const TB_GAP = "bg-dash-border mx-1 hidden h-4 w-px shrink-0 sm:block";

type Tool = "select" | "comment" | "draw" | "highlight";
type InkKind = "draw" | "highlight";

export type SavedCommentPreview = {
  id: string;
  authorName: string;
  authorKind: string;
  body: string;
  kind: string;
  pageNumber: number | null;
};

const DRAW_COLORS = ["#dc2626", "#2563eb", "#059669", "#ca8a04"];
const HIGHLIGHT_COLORS = ["#fde047", "#fdba74", "#86efac", "#7dd3fc"];

function authorLabel(kind: string) {
  if (kind === "supervisor") return "Supervisor";
  if (kind === "staff") return "Staff";
  return "Student";
}

function strokeCentroid(strokes: ReviewStroke[]): { x: number; y: number } {
  const pts = strokes.flatMap((s) => s.points);
  if (!pts.length) return { x: 0.85, y: 0.2 };
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  };
}

export function ReviewPaper({
  pdfUrl,
  marks,
  disabled,
  canSplit,
  onSplit,
  onAddComment,
  onAddDraw,
  onDeleteMark,
  canDelete,
}: {
  pdfUrl: string;
  marks: ReviewMark[];
  disabled?: boolean;
  /** Show Split tool — creates a page-range partial under this document. */
  canSplit?: boolean;
  onSplit?: (pageFrom: number, pageTo: number) => void;
  onAddComment: (
    input: { pageNumber: number; pinX: number; pinY: number; body: string },
    onOk?: (saved?: SavedCommentPreview) => void,
  ) => void;
  onAddDraw: (
    input: {
      pageNumber: number;
      strokes: ReviewStroke[];
      body: string;
      pinX: number;
      pinY: number;
      kind?: InkKind;
    },
    onOk?: (saved?: SavedCommentPreview) => void,
  ) => void;
  onDeleteMark?: (id: string) => void;
  canDelete?: (mark: ReviewMark) => boolean;
}) {
  const [tool, setTool] = useState<Tool>("highlight");
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageJump, setPageJump] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingPin, setPendingPin] = useState<{ page: number; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [activeMarkId, setActiveMarkId] = useState<string | null>(null);
  const [showMarks, setShowMarks] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [savedPreview, setSavedPreview] = useState<SavedCommentPreview | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitFrom, setSplitFrom] = useState("");
  const [splitTo, setSplitTo] = useState("");
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

  function goToPage(n: number) {
    if (!pageCount) return;
    const page = Math.max(1, Math.min(pageCount, Math.round(n)));
    setCurrentPage(page);
    setPageJump(String(page));
    document.getElementById(`review-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bumpZoom(delta: number) {
    setZoom((z) => Math.min(2, Math.max(0.5, Math.round((z + delta) * 20) / 20)));
  }

  function afterSave(saved?: SavedCommentPreview) {
    if (saved?.id) {
      setActiveMarkId(saved.id);
      setSavedPreview(saved);
      setShowMarks(true);
    }
  }

  useEffect(() => {
    if (!savedPreview?.id) return;
    if (!marks.some((m) => m.id === savedPreview.id)) return;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-mark-pin="${savedPreview.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
  }, [marks, savedPreview]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const doc = await pdfjs.getDocument({ url: pdfUrl, withCredentials: false }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        pdfRef.current = doc;
        setPageCount(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open this PDF.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [pdfUrl]);

  const pageMarks = useMemo(() => {
    const map = new Map<number, ReviewMark[]>();
    for (const m of marks) {
      if (m.kind === "general" || !m.page_number) continue;
      const list = map.get(m.page_number) ?? [];
      list.push(m);
      map.set(m.page_number, list);
    }
    return map;
  }, [marks]);

  useEffect(() => {
    setPageJump(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (!splitOpen) return;
    setSplitFrom((v) => v || String(currentPage));
    setSplitTo((v) => v || String(currentPage));
  }, [splitOpen, currentPage]);

  return (
    <div className="space-y-3">
      {/* Desktop ribbon: one strip, no boxed button groups */}
      <div className="border-dash-border bg-dash-card sticky top-[3.75rem] z-20 -mx-1 border sm:top-[4.25rem]">
        <div className="flex flex-col gap-1 px-1.5 py-1 sm:px-2">
          <div className="flex flex-wrap items-center gap-0.5">
            <div className="flex items-center" role="toolbar" aria-label="Mark tools">
              {(
                [
                  ["select", "View"],
                  ["highlight", "Highlight"],
                  ["draw", "Draw"],
                  ["comment", "Pin"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setTool(k);
                    setPendingPin(null);
                    setSplitOpen(false);
                  }}
                  className={tool === k && !splitOpen ? TB_ON : TB_OFF}
                >
                  {label}
                </button>
              ))}
              {canSplit && onSplit ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setSplitOpen((v) => !v);
                    setPendingPin(null);
                    setTool("select");
                  }}
                  className={splitOpen ? TB_ON : TB_OFF}
                  title="Split pages into a partial"
                >
                  Split
                </button>
              ) : null}
            </div>

            {(tool === "draw" || tool === "highlight") && (
              <>
                <span className={TB_GAP} aria-hidden />
                <div className="flex items-center gap-1 px-1" role="group" aria-label="Colour">
                  {(tool === "draw" ? DRAW_COLORS : HIGHLIGHT_COLORS).map((c) => {
                    const active = tool === "draw" ? drawColor === c : highlightColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Colour ${c}`}
                        aria-pressed={active}
                        onClick={() => (tool === "draw" ? setDrawColor(c) : setHighlightColor(c))}
                        className={`h-5 w-5 shrink-0 rounded-none ${active ? "outline outline-1 outline-offset-1 outline-dash-foreground" : ""}`}
                        style={{ background: c }}
                      />
                    );
                  })}
                </div>
              </>
            )}

            <span className={TB_GAP} aria-hidden />

            <div className="flex items-center" role="group" aria-label="Pages">
              <button
                type="button"
                className={TB_ICON}
                disabled={!pageCount || currentPage <= 1}
                aria-label="Previous page"
                onClick={() => goToPage(currentPage - 1)}
              >
                ‹
              </button>
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(pageJump);
                  if (Number.isFinite(n)) goToPage(n);
                }}
              >
                <input
                  value={pageJump}
                  onChange={(e) => setPageJump(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => {
                    const n = Number(pageJump);
                    if (Number.isFinite(n) && n >= 1) goToPage(n);
                    else setPageJump(String(currentPage));
                  }}
                  aria-label="Page number"
                  className="bg-dash-muted/50 text-dash-foreground h-6 w-9 rounded-none border-0 text-center text-xs font-semibold tabular-nums outline-none focus:ring-1 focus:ring-dash-accent/40"
                />
                <span className="text-dash-muted-foreground text-xs tabular-nums">/ {pageCount || "—"}</span>
              </form>
              <button
                type="button"
                className={TB_ICON}
                disabled={!pageCount || currentPage >= pageCount}
                aria-label="Next page"
                onClick={() => goToPage(currentPage + 1)}
              >
                ›
              </button>
            </div>

            <span className={TB_GAP} aria-hidden />

            <div className="flex items-center" role="group" aria-label="Zoom">
              <button type="button" className={TB_ICON} aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => bumpZoom(-0.1)}>
                −
              </button>
              <button
                type="button"
                className={`${TB_OFF} min-w-[2.75rem] tabular-nums`}
                aria-label="Reset zoom"
                title="Fit width"
                onClick={() => setZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" className={TB_ICON} aria-label="Zoom in" disabled={zoom >= 2} onClick={() => bumpZoom(0.1)}>
                +
              </button>
              <button type="button" className={TB_OFF} onClick={() => setZoom(1)} title="Fit page width">
                Fit
              </button>
            </div>

            <span className={TB_GAP} aria-hidden />

            <div className="flex items-center">
              <button type="button" className={showMarks ? TB_ON : TB_OFF} onClick={() => setShowMarks((v) => !v)}>
                Marks
              </button>
              <button type="button" className={showComments ? TB_ON : TB_OFF} onClick={() => setShowComments((v) => !v)}>
                Comments
              </button>
              <a href={pdfUrl} target="_blank" rel="noreferrer" className={TB_OFF}>
                Open PDF
              </a>
            </div>
          </div>

          {splitOpen && canSplit && onSplit ? (
            <form
              className="border-dash-border/70 flex flex-wrap items-center gap-1.5 border-t pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                const from = Number(splitFrom);
                const to = Number(splitTo);
                if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) return;
                onSplit(from, to);
                setSplitOpen(false);
                setSplitFrom("");
                setSplitTo("");
              }}
            >
              <span className="text-dash-muted-foreground px-1 text-[11px] font-semibold uppercase">Pages</span>
              <input
                type="number"
                min={1}
                max={pageCount || undefined}
                value={splitFrom}
                onChange={(e) => setSplitFrom(e.target.value)}
                placeholder="From"
                required
                aria-label="Split from page"
                className="bg-dash-muted/50 text-dash-foreground h-7 w-14 rounded-none border-0 px-1.5 text-xs font-semibold tabular-nums outline-none focus:ring-1 focus:ring-dash-accent/40"
              />
              <span className="text-dash-muted-foreground text-xs">to</span>
              <input
                type="number"
                min={1}
                max={pageCount || undefined}
                value={splitTo}
                onChange={(e) => setSplitTo(e.target.value)}
                placeholder="To"
                required
                aria-label="Split to page"
                className="bg-dash-muted/50 text-dash-foreground h-7 w-14 rounded-none border-0 px-1.5 text-xs font-semibold tabular-nums outline-none focus:ring-1 focus:ring-dash-accent/40"
              />
              <button type="submit" disabled={disabled} className={TB_ON}>
                Create partial
              </button>
              <button
                type="button"
                className={TB_OFF}
                onClick={() => {
                  setSplitOpen(false);
                  setSplitFrom("");
                  setSplitTo("");
                }}
              >
                Cancel
              </button>
            </form>
          ) : null}
        </div>
        <p className="text-dash-muted-foreground bg-dash-muted/30 px-2.5 py-1 text-[11px]">
          {splitOpen
            ? "Choose a page range to create a partial under this document."
            : tool === "highlight"
              ? "Drag across the words to highlight, then Save a comment."
              : tool === "draw"
                ? "Draw on the paper, then Save a comment."
                : tool === "comment"
                  ? "Click a spot to pin a note."
                  : "Scroll or use page controls. Click a number or card to jump."}
        </p>
      </div>

      {loading ? <p className="text-dash-muted-foreground text-sm">Opening paper…</p> : null}
      {error ? (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-300">
          {error} You can still download the PDF and use the note list below.
        </p>
      ) : null}

      {savedPreview ? (
        <div className="border-dash-border bg-dash-card flex flex-wrap items-start gap-3 rounded-none border px-3 py-2.5 text-sm shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="text-dash-muted-foreground text-[11px] font-semibold uppercase">Saved comment</p>
            <p className="text-dash-foreground mt-0.5 font-semibold">
              {savedPreview.authorName}{" "}
              <span className="text-dash-muted-foreground font-medium">({authorLabel(savedPreview.authorKind)})</span>
              {savedPreview.pageNumber ? (
                <span className="text-dash-muted-foreground font-normal"> · page {savedPreview.pageNumber}</span>
              ) : null}
            </p>
            <p className="text-dash-foreground mt-1 whitespace-pre-wrap">{savedPreview.body}</p>
            <p className="text-dash-muted-foreground mt-1 text-xs">Highlighted on the paper. Click the card on the right anytime to find it again.</p>
          </div>
          <button type="button" className={BTN_GHOST} onClick={() => setSavedPreview(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {pendingPin ? (
        <form
          className="border-dash-accent/40 bg-dash-accent/5 flex flex-col gap-2 rounded-none border p-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onAddComment(
              {
                pageNumber: pendingPin.page,
                pinX: pendingPin.x,
                pinY: pendingPin.y,
                body: draft.trim(),
              },
              afterSave,
            );
            setDraft("");
            setPendingPin(null);
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">
              Note on page {pendingPin.page}
            </span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              maxLength={3000}
              placeholder="What should change here?"
              className={INPUT}
            />
          </label>
          <button type="submit" disabled={disabled || !draft.trim()} className={BTN}>
            Save
          </button>
          <button type="button" className={BTN_SOFT} onClick={() => setPendingPin(null)}>
            Cancel
          </button>
        </form>
      ) : null}

      <div className="space-y-6">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
          <PaperPage
            key={page}
            id={`review-page-${page}`}
            pageNumber={page}
            pdfRef={pdfRef}
            zoom={zoom}
            showComments={showComments}
            marks={showMarks ? pageMarks.get(page) ?? [] : []}
            tool={tool}
            inkColor={tool === "highlight" ? highlightColor : drawColor}
            disabled={disabled}
            activeMarkId={activeMarkId}
            onActivate={setActiveMarkId}
            onVisiblePage={setCurrentPage}
            onPin={(x, y) => {
              setPendingPin({ page, x, y });
              setTool("comment");
            }}
            onInkSave={(strokes, body, kind) => {
              const c = strokeCentroid(strokes);
              onAddDraw({ pageNumber: page, strokes, body, pinX: c.x, pinY: c.y, kind }, afterSave);
            }}
            onDeleteMark={onDeleteMark}
            canDelete={canDelete}
          />
        ))}
      </div>

    </div>
  );
}

function PaperPage({
  id,
  pageNumber,
  pdfRef,
  zoom,
  showComments,
  marks,
  tool,
  inkColor,
  disabled,
  activeMarkId,
  onActivate,
  onVisiblePage,
  onPin,
  onInkSave,
  onDeleteMark,
  canDelete,
}: {
  id: string;
  pageNumber: number;
  pdfRef: MutableRefObject<import("pdfjs-dist").PDFDocumentProxy | null>;
  zoom: number;
  showComments: boolean;
  marks: ReviewMark[];
  tool: Tool;
  inkColor: string;
  disabled?: boolean;
  activeMarkId: string | null;
  onActivate: (id: string | null) => void;
  onVisiblePage?: (page: number) => void;
  onPin: (x: number, y: number) => void;
  onInkSave: (strokes: ReviewStroke[], body: string, kind: InkKind) => void;
  onDeleteMark?: (id: string) => void;
  canDelete?: (mark: ReviewMark) => boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draftStrokes, setDraftStrokes] = useState<ReviewStroke[]>([]);
  const [pendingInk, setPendingInk] = useState<{ strokes: ReviewStroke[]; kind: InkKind } | null>(null);
  const [drawNote, setDrawNote] = useState("");
  /** Floating Add-comment / comment panel near the mark (draggable). */
  const [floatUi, setFloatUi] = useState<{ x: number; y: number; mode: "button" | "form" } | null>(null);
  const drawing = useRef<ReviewStroke | null>(null);
  /** Straight word highlight: drag corner A → corner B (axis-aligned). */
  const highlightDrag = useRef<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);
  const dragFloat = useRef<{ ox: number; oy: number; startX: number; startY: number } | null>(null);
  const LINE_H = 0.018; // ~one text line in normalized page coords

  function openFloatNear(strokes: ReviewStroke[], mode: "button" | "form" = "button") {
    const c = strokeCentroid(strokes);
    // Prefer left of the mark so it stays easy to catch.
    setFloatUi({
      x: Math.max(0.02, Math.min(0.72, c.x < 0.55 ? c.x : c.x - 0.28)),
      y: Math.max(0.02, Math.min(0.85, c.y + 0.02)),
      mode,
    });
  }

  const threaded = useMemo(() => {
    const list = marks.filter((m) => m.kind === "draw" || m.kind === "comment" || m.kind === "highlight");
    return list.map((m, i) => ({ mark: m, n: i + 1 }));
  }, [marks]);

  /** Margin comments aligned to the mark’s vertical position on the page (Word-style). */
  const alignedComments = useMemo(() => {
    const items = threaded.map(({ mark, n }) => {
      const c =
        (mark.kind === "draw" || mark.kind === "highlight") && mark.strokes.length
          ? strokeCentroid(mark.strokes)
          : { x: mark.pin_x ?? 0.9, y: mark.pin_y ?? 0.08 };
      return { mark, n, y: c.y };
    });
    items.sort((a, b) => a.y - b.y || a.n - b.n);
    const cardFrac = 0.12;
    let lastBottom = 0;
    return items.map((item) => {
      let top = Math.max(0.01, item.y - 0.01);
      if (top < lastBottom) top = lastBottom;
      lastBottom = top + cardFrac;
      return { ...item, top: Math.min(0.88, top) };
    });
  }, [threaded]);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!pdf || !canvas || !wrap) return;

    let cancelled = false;
    let paintGen = 0;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    async function paint() {
      if (!pdf || !canvas || !wrap) return;
      const gen = ++paintGen;
      // pdf.js forbids overlapping render() on the same canvas
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          /* already done */
        }
        renderTask = null;
      }
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled || gen !== paintGen) return;
        const base = page.getViewport({ scale: 1 });
        const width = Math.min(720, wrap.clientWidth || 520) * zoom;
        const scale = width / base.width;
        const viewport = page.getViewport({ scale: Math.min(3, Math.max(0.5, scale)) });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const task = page.render({ canvasContext: ctx, viewport });
        renderTask = task;
        await task.promise;
        if (cancelled || gen !== paintGen) return;
        setSize({ w: viewport.width, h: viewport.height });
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.width = viewport.width;
          overlay.height = viewport.height;
        }
      } catch (err) {
        const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
        if (name === "RenderingCancelledException" || cancelled || gen !== paintGen) return;
        console.error(err);
      } finally {
        if (gen === paintGen) renderTask = null;
      }
    }

    void paint();
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => void paint(), 120);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, [pageNumber, pdfRef, zoom]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !onVisiblePage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.35)) onVisiblePage(pageNumber);
      },
      { threshold: [0.35] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onVisiblePage, pageNumber]);

  const paintOverlay = useCallback(
    (extra: ReviewStroke[] = draftStrokes, extraKind: InkKind | null = null) => {
      const overlay = overlayRef.current;
      if (!overlay || !size.w) return;
      const ctx = overlay.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      const paintStroke = (s: ReviewStroke, highlight: boolean) => {
        if (s.points.length < 2) return;
        // Straight highlight band: exactly 2 corners → filled rectangle (PDF-tool style).
        if (highlight && s.points.length === 2) {
          const x1 = s.points[0].x * overlay.width;
          const y1 = s.points[0].y * overlay.height;
          const x2 = s.points[1].x * overlay.width;
          const y2 = s.points[1].y * overlay.height;
          ctx.globalCompositeOperation = "multiply";
          ctx.fillStyle = s.color;
          ctx.globalAlpha = 0.4;
          ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
          return;
        }
        ctx.beginPath();
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = highlight ? 0.45 : 1;
        ctx.lineWidth = (highlight ? s.width * 4.5 : s.width) * (overlay.width / 480);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation = highlight ? "multiply" : "source-over";
        ctx.moveTo(s.points[0].x * overlay.width, s.points[0].y * overlay.height);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x * overlay.width, s.points[i].y * overlay.height);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      };

      const paintHighlightPreview = () => {
        const d = highlightDrag.current;
        if (!d) return;
        const x1 = d.a.x * overlay.width;
        const y1 = d.a.y * overlay.height;
        const x2 = d.b.x * overlay.width;
        const y2 = d.b.y * overlay.height;
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = inkColor;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1) || 1, Math.abs(y2 - y1) || 1);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      };

      for (const m of marks) {
        if (m.kind === "draw" || m.kind === "highlight") {
          for (const s of m.strokes) paintStroke(s, m.kind === "highlight");
        }
      }
      for (const s of extra) paintStroke(s, extraKind === "highlight" || tool === "highlight");
      if (pendingInk) {
        for (const s of pendingInk.strokes) paintStroke(s, pendingInk.kind === "highlight");
      }
      paintHighlightPreview();

      if (activeMarkId) {
        const active = marks.find((m) => m.id === activeMarkId);
        if (active && (active.kind === "draw" || active.kind === "highlight") && active.strokes.length) {
          let minX = 1;
          let minY = 1;
          let maxX = 0;
          let maxY = 0;
          for (const s of active.strokes) {
            for (const p of s.points) {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x);
              maxY = Math.max(maxY, p.y);
            }
            if (s.points.length < 2) continue;
            ctx.beginPath();
            ctx.strokeStyle = "#2563eb";
            ctx.lineWidth = (s.width + 3) * (overlay.width / 480);
            ctx.globalAlpha = 0.45;
            ctx.lineCap = "round";
            ctx.moveTo(s.points[0].x * overlay.width, s.points[0].y * overlay.height);
            for (let i = 1; i < s.points.length; i++) {
              ctx.lineTo(s.points[i].x * overlay.width, s.points[i].y * overlay.height);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          const pad = 0.02;
          ctx.setLineDash([8, 6]);
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.9;
          ctx.strokeRect(
            (minX - pad) * overlay.width,
            (minY - pad) * overlay.height,
            (maxX - minX + pad * 2) * overlay.width,
            (maxY - minY + pad * 2) * overlay.height,
          );
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        } else if (active && active.kind === "comment" && active.pin_x != null && active.pin_y != null) {
          const r = 18;
          ctx.beginPath();
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.arc(active.pin_x * overlay.width, active.pin_y * overlay.height, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    },
    [activeMarkId, draftStrokes, inkColor, marks, pendingInk, size.w, tool],
  );

  useEffect(() => {
    paintOverlay();
  }, [paintOverlay]);

  function norm(e: ReactPointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  function finishDraft(openForm = true) {
    if (!draftStrokes.length) return;
    const kind: InkKind = tool === "highlight" ? "highlight" : "draw";
    const strokes = draftStrokes;
    setPendingInk({ strokes, kind });
    setDraftStrokes([]);
    setDrawNote("");
    paintOverlay([]);
    if (openForm) openFloatNear(strokes, "form");
  }

  function clearDraft() {
    setDraftStrokes([]);
    setFloatUi(null);
    setPendingInk(null);
    setDrawNote("");
    highlightDrag.current = null;
    paintOverlay([]);
  }

  const inkActive = (tool === "draw" || tool === "highlight") && !pendingInk;

  return (
    <div id={id} ref={rootRef} className="border-dash-border overflow-hidden rounded-none border bg-white shadow-sm">
      <div className="border-dash-border bg-dash-muted/40 flex items-center justify-between border-b px-3 py-1.5 text-xs font-semibold">
        <span>Page {pageNumber}</span>
        <span className="text-dash-muted-foreground font-normal">
          {threaded.length} comment{threaded.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* One scroll so paper + margin comments stay vertically aligned */}
      <div className="max-h-[min(80vh,48rem)] overflow-auto">
        <div className={`grid gap-0 ${showComments ? "lg:grid-cols-[minmax(0,1fr)_17rem]" : ""}`}>
        <div ref={wrapRef} className="relative bg-slate-200/60 p-2 sm:p-3">
          <div
            className="relative mx-auto"
            style={{ width: size.w ? Math.min(size.w, wrapRef.current?.clientWidth || size.w) : "100%", maxWidth: "100%" }}
          >
            <canvas ref={canvasRef} className="block h-auto w-full" />
            <canvas
              ref={overlayRef}
              className={`absolute inset-0 h-full w-full ${
                inkActive ? "cursor-crosshair" : tool === "comment" ? "cursor-cell" : "pointer-events-none"
              }`}
              onPointerDown={(e) => {
                if (disabled || pendingInk) return;
                if (tool === "comment") {
                  onPin(norm(e).x, norm(e).y);
                  return;
                }
                if (!inkActive) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                const p = norm(e);
                if (tool === "highlight") {
                  highlightDrag.current = { a: p, b: p };
                  paintOverlay(draftStrokes, "highlight");
                  return;
                }
                drawing.current = { color: inkColor, width: 2.5, points: [p] };
              }}
              onPointerMove={(e) => {
                if (tool === "highlight" && highlightDrag.current) {
                  const p = norm(e);
                  // Keep a straight text-line band: mostly horizontal; height at least one line.
                  const a = highlightDrag.current.a;
                  let y0 = Math.min(a.y, p.y);
                  let y1 = Math.max(a.y, p.y);
                  if (y1 - y0 < LINE_H) {
                    const mid = (a.y + p.y) / 2;
                    y0 = Math.max(0, mid - LINE_H / 2);
                    y1 = Math.min(1, mid + LINE_H / 2);
                  }
                  highlightDrag.current = {
                    a: { x: Math.min(a.x, p.x), y: y0 },
                    b: { x: Math.max(a.x, p.x), y: y1 },
                  };
                  paintOverlay(draftStrokes, "highlight");
                  return;
                }
                if (!drawing.current) return;
                drawing.current.points.push(norm(e));
                paintOverlay([...draftStrokes, drawing.current], "draw");
              }}
              onPointerUp={() => {
                if (tool === "highlight" && highlightDrag.current) {
                  const { a, b } = highlightDrag.current;
                  highlightDrag.current = null;
                  if (Math.abs(b.x - a.x) < 0.008) {
                    paintOverlay(draftStrokes, "highlight");
                    return;
                  }
                  const band: ReviewStroke = {
                    color: inkColor,
                    width: 1,
                    points: [
                      { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
                      { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
                    ],
                  };
                  const next = [...draftStrokes, band];
                  setDraftStrokes(next);
                  paintOverlay(next, "highlight");
                  openFloatNear(next, "button");
                  return;
                }
                if (!drawing.current || drawing.current.points.length < 2) {
                  drawing.current = null;
                  return;
                }
                const next = [...draftStrokes, drawing.current];
                drawing.current = null;
                setDraftStrokes(next);
                paintOverlay(next, "draw");
                openFloatNear(next, "button");
              }}
            />

            {floatUi && (draftStrokes.length > 0 || pendingInk) ? (
              <div
                className="absolute z-30 w-[min(16rem,78%)] touch-none"
                style={{ left: `${floatUi.x * 100}%`, top: `${floatUi.y * 100}%` }}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest("textarea,button,input")) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragFloat.current = {
                    ox: e.clientX,
                    oy: e.clientY,
                    startX: floatUi.x,
                    startY: floatUi.y,
                  };
                }}
                onPointerMove={(e) => {
                  if (!dragFloat.current || !wrapRef.current) return;
                  const box = wrapRef.current.querySelector(".relative.mx-auto") as HTMLElement | null;
                  const rect = (box ?? wrapRef.current).getBoundingClientRect();
                  const dx = (e.clientX - dragFloat.current.ox) / Math.max(1, rect.width);
                  const dy = (e.clientY - dragFloat.current.oy) / Math.max(1, rect.height);
                  setFloatUi((f) =>
                    f
                      ? {
                          ...f,
                          x: Math.max(0.01, Math.min(0.75, dragFloat.current!.startX + dx)),
                          y: Math.max(0.01, Math.min(0.9, dragFloat.current!.startY + dy)),
                        }
                      : f,
                  );
                }}
                onPointerUp={() => {
                  dragFloat.current = null;
                }}
              >
                {floatUi.mode === "button" ? (
                  <div className="flex flex-col gap-1.5 rounded-none border border-amber-500/50 bg-white p-2 shadow-lg">
                    <p className="text-dash-muted-foreground cursor-grab text-[10px] font-semibold active:cursor-grabbing">
                      Drag to move
                    </p>
                    <button type="button" className={BTN} disabled={disabled} onClick={() => finishDraft(true)}>
                      Add comment
                    </button>
                    <button type="button" className={BTN_GHOST} onClick={clearDraft}>
                      Clear mark
                    </button>
                  </div>
                ) : (
                  <form
                    className="rounded-none border border-amber-500/50 bg-white p-2.5 shadow-lg"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!drawNote.trim() || !pendingInk) return;
                      onInkSave(pendingInk.strokes, drawNote.trim(), pendingInk.kind);
                      setPendingInk(null);
                      setDrawNote("");
                      setFloatUi(null);
                    }}
                  >
                    <p className="text-dash-muted-foreground mb-1 cursor-grab text-[10px] font-semibold active:cursor-grabbing">
                      Drag to move · {pendingInk?.kind === "highlight" ? "Highlight" : "Drawing"} comment
                    </p>
                    <textarea
                      value={drawNote}
                      onChange={(e) => setDrawNote(e.target.value)}
                      autoFocus
                      rows={3}
                      maxLength={3000}
                      placeholder="What must change here? (Enter to Save)"
                      className={`${INPUT} resize-y text-sm`}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || e.shiftKey) return;
                        e.preventDefault();
                        if (disabled || !drawNote.trim()) return;
                        e.currentTarget.form?.requestSubmit();
                      }}
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button type="submit" disabled={disabled || !drawNote.trim()} className={BTN}>
                        Save
                      </button>
                      <button type="button" className={BTN_SOFT} onClick={clearDraft}>
                        Discard
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}

            {threaded.map(({ mark: m, n }) => {
              const c =
                (m.kind === "draw" || m.kind === "highlight") && m.strokes.length
                  ? strokeCentroid(m.strokes)
                  : { x: m.pin_x ?? 0.9, y: m.pin_y ?? Math.min(0.9, 0.1 + n * 0.08) };
              const open = activeMarkId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  data-mark-pin={m.id}
                  onClick={() => onActivate(open ? null : m.id)}
                  className={`absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-bold text-white shadow ring-2 ${
                    open ? "ring-sky-400 scale-125" : "ring-white"
                  } ${
                    m.kind === "highlight"
                      ? "bg-amber-500"
                      : m.author_kind === "supervisor"
                        ? "bg-violet-600"
                        : "bg-rose-600"
                  }`}
                  style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                  title={m.body ?? ""}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {showComments ? (
        <aside
          className="border-dash-border bg-dash-muted/20 relative border-t p-2 lg:border-t-0 lg:border-l"
          style={{ minHeight: size.h ? Math.max(size.h, alignedComments.length * 96) : undefined }}
        >
          <p className="text-dash-muted-foreground bg-dash-muted/20 sticky top-0 z-10 px-1 pb-2 text-[11px] font-semibold tracking-wide uppercase backdrop-blur-sm">
            Comments
          </p>

          {!threaded.length && !floatUi ? (
            <p className="text-dash-muted-foreground px-1 text-xs">
              Highlight or draw on the paper. Comments line up next to the marked section.
            </p>
          ) : null}

          {floatUi ? (
            <p className="text-dash-muted-foreground px-1 text-xs">Use the floating box on the paper (drag to move).</p>
          ) : null}

          {/* Desktop / wide: cards sit at the same height as the mark on the page */}
          <div className="relative hidden min-h-full lg:block" style={{ height: size.h || "100%" }}>
            {alignedComments.map(({ mark: m, n, top, y }) => {
              const open = activeMarkId === m.id;
              const label = m.kind === "highlight" ? "Highlight" : m.kind === "draw" ? "Drawing" : "Pin";
              return (
                <div key={m.id} className="absolute right-0 left-0 px-1" style={{ top: `${top * 100}%` }}>
                  {/* Connector toward the paper mark */}
                  <div
                    className="pointer-events-none absolute top-3 -left-2 hidden h-px w-2 bg-amber-500/70 xl:block"
                    style={{ marginTop: `${Math.max(-8, (y - top) * (size.h || 0) * 0)}px` }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    data-mark-card={m.id}
                    onClick={() => {
                      const next = open ? null : m.id;
                      onActivate(next);
                      if (next) {
                        requestAnimationFrame(() => {
                          document
                            .querySelector(`[data-mark-pin="${m.id}"]`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                        });
                      }
                    }}
                    className={`w-full rounded-none border p-2.5 text-left text-xs shadow-sm transition ${
                      open
                        ? "border-sky-500 bg-sky-50 ring-1 ring-sky-300"
                        : "border-dash-border bg-white hover:border-dash-accent/40"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                          m.kind === "highlight"
                            ? "bg-amber-500"
                            : m.author_kind === "supervisor"
                              ? "bg-violet-600"
                              : "bg-rose-600"
                        }`}
                      >
                        {n}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{m.author_name}</span>
                      <span className="text-dash-muted-foreground shrink-0">{label}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-500">{authorLabel(m.author_kind)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">{m.body || "(no text)"}</p>
                    {onDeleteMark && canDelete?.(m) ? (
                      <span
                        role="link"
                        tabIndex={0}
                        className="mt-2 inline-block font-semibold text-rose-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMark(m.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            onDeleteMark(m.id);
                          }
                        }}
                      >
                        Remove
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Mobile: stacked list (aligned layout needs side-by-side space) */}
          <div className="space-y-2 lg:hidden">
            {alignedComments.map(({ mark: m, n }) => {
              const open = activeMarkId === m.id;
              const label = m.kind === "highlight" ? "Highlight" : m.kind === "draw" ? "Drawing" : "Pin";
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onActivate(open ? null : m.id)}
                  className={`w-full rounded-none border p-2.5 text-left text-xs shadow-sm ${
                    open ? "border-sky-500 bg-sky-50" : "border-dash-border bg-white"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {n}
                    </span>
                    <span className="font-semibold text-slate-900">{m.author_name}</span>
                    <span className="text-dash-muted-foreground ml-auto">{label}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700">{m.body || "(no text)"}</p>
                </button>
              );
            })}
          </div>
        </aside>
        ) : null}
        </div>
      </div>
    </div>
  );
}
