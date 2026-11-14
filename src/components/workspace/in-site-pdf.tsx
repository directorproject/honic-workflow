"use client";

import { useEffect, useRef, useState } from "react";

import { Modal } from "@/components/workspace/ws-ui";
import { loadPdfJs } from "@/lib/workspace/pdfjs";

/** Full-page PDF reader that stays inside the app (no new browser tab). */
export function InSitePdfModal({
  open,
  url,
  title,
  onClose,
}: {
  open: boolean;
  url: string | null;
  title: string;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setPageCount(0);
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const doc = await pdfjs.getDocument({ url }).promise;
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
  }, [open, url]);

  useEffect(() => {
    if (!open || !pageCount || !listRef.current) return;
    const host = listRef.current;
    host.innerHTML = "";
    let cancelled = false;
    (async () => {
      const pdf = pdfRef.current;
      if (!pdf) return;
      for (let n = 1; n <= pageCount; n++) {
        if (cancelled) return;
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const width = Math.min(860, host.clientWidth || 640);
        const viewport = page.getViewport({ scale: width / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = "mx-auto mb-4 block max-w-full rounded-lg bg-white shadow";
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        host.appendChild(canvas);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pageCount]);

  return (
    <Modal open={open} title={title || "PDF"} onClose={onClose} wide>
      <div className="flex max-h-[min(82vh,52rem)] flex-col">
        <div className="text-dash-muted-foreground mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>{loading ? "Opening…" : error ? "Could not load" : `${pageCount} page${pageCount === 1 ? "" : "s"}`}</span>
          {url ? (
            <a href={url} className="text-dash-accent font-semibold" download>
              Download
            </a>
          ) : null}
        </div>
        {error ? <p className="text-sm font-medium text-rose-600 dark:text-rose-300">{error}</p> : null}
        <div ref={listRef} className="min-h-40 flex-1 overflow-auto rounded-xl bg-slate-200/70 p-3" />
      </div>
    </Modal>
  );
}
