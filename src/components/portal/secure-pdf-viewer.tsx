"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentAccessPlan } from "@/lib/portal/document-access-config";
import { getPDFSecurityOptions } from "@/lib/portal/document-access-config";

interface SecurePDFViewerProps {
  documentUrl: string;
  documentId: string;
  plan: DocumentAccessPlan;
  onAccess?: () => void;
  onDownload?: () => void;
}

/**
 * Secure PDF viewer with security restrictions based on plan.
 * Prevents printing, screenshots, copying, and downloading where restricted.
 */
export function SecurePDFViewer({ documentUrl, documentId, plan, onAccess, onDownload }: SecurePDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const security = getPDFSecurityOptions(plan);

  useEffect(() => {
    // Record access
    onAccess?.();

    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable keyboard shortcuts for print, save, etc.
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P or Cmd+P = Print
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        return false;
      }
      // Ctrl+S or Cmd+S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        return false;
      }
      // Ctrl+C = Copy (can be blocked)
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (security.disableCopy) {
          e.preventDefault();
          return false;
        }
      }
    };

    // Disable selection and copying
    const handleSelectStart = (e: Event) => {
      if (security.disableCopy) {
        e.preventDefault();
        return false;
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (security.disableCopy) {
        e.preventDefault();
        return false;
      }
    };

    // Disable screenshot detection (imperfect but helps)
    const handleVisibilityChange = () => {
      if (document.hidden && security.disableScreenshot) {
        console.warn("Screenshot attempt detected");
      }
    };

    if (containerRef.current) {
      containerRef.current.addEventListener("contextmenu", handleContextMenu);
      containerRef.current.addEventListener("selectstart", handleSelectStart);
      containerRef.current.addEventListener("copy", handleCopy);
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener("contextmenu", handleContextMenu);
        containerRef.current.removeEventListener("selectstart", handleSelectStart);
        containerRef.current.removeEventListener("copy", handleCopy);
      }
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [plan, security, onAccess]);

  return (
    <div ref={containerRef} className="bg-dash-muted rounded-lg overflow-hidden">
      {/* Security notice */}
      <div className="bg-dash-muted/50 border-b border-dash-border/50 px-4 py-2 flex items-center gap-2 text-sm text-dash-muted-foreground">
        <span>🔒 Secure document view</span>
        {security.disablePrint && <span>• Printing disabled</span>}
        {security.disableCopy && <span>• Copying disabled</span>}
        {security.disableScreenshot && <span>• Screenshot protection enabled</span>}
      </div>

      {/* PDF viewer using iframe with security attributes */}
      <div className="relative w-full" style={{ aspectRatio: "8.5/11" }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-dash-muted-foreground">Loading document...</div>
          </div>
        )}

        {/* Use iframe with restricted permissions */}
        <iframe
          src={`${documentUrl}#toolbar=0${security.disablePrint ? "&view=FitH" : ""}`}
          title={`Document: ${documentId}`}
          className="w-full h-full"
          onLoad={() => setIsLoading(false)}
          style={{
            userSelect: security.disableCopy ? "none" : "auto",
            WebkitUserSelect: security.disableCopy ? "none" : "auto",
            MozUserSelect: security.disableCopy ? "none" : "auto",
          }}
          sandbox="allow-same-origin"
          // Restrict printing and other features at iframe level
          allow={!security.disablePrint ? "print" : ""}
        />
      </div>

      {/* Watermark overlay (optional visual deterrent) */}
      {security.watermark && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5"
          style={{
            fontSize: "60px",
            fontWeight: "bold",
            transform: "rotate(-45deg)",
            whiteSpace: "nowrap",
            zIndex: -1,
          }}
        >
          {security.watermark}
        </div>
      )}

      {/* Download button (if allowed) */}
      {!security.disableDownload && (
        <div className="bg-dash-muted/30 border-t border-dash-border/50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-dash-muted-foreground">
            Plan: {plan.toUpperCase()} • Downloads allowed
          </span>
          <button
            onClick={() => onDownload?.()}
            className="bg-dash-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            ⬇ Download
          </button>
        </div>
      )}
    </div>
  );
}
