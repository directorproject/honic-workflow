"use client";

type PdfJs = typeof import("pdfjs-dist");

let loading: Promise<PdfJs> | null = null;

/** Load pdf.js once and point the worker at a static public file (not HTML from middleware). */
export function loadPdfJs(): Promise<PdfJs> {
  if (!loading) {
    loading = (async () => {
      const pdfjs = await import("pdfjs-dist");
      // Served from /public; middleware must allow this path through.
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    })();
  }
  return loading;
}
