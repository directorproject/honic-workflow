import { useEffect, useCallback, useRef } from "react";
import type { PortalJobMessage } from "@/lib/portal/jobs-shared";

type StreamMessage =
  | { type: "connected" }
  | { type: "messages"; messages: PortalJobMessage[] };

/**
 * Real-time job messages via Server-Sent Events (SSE)
 * Provides instant message delivery like WhatsApp instead of polling every 1.5s
 * Falls back to fetch polling if SSE fails
 */
export function useJobMessageStream(
  applicationPublicId: string | null,
  onMessages: (messages: PortalJobMessage[]) => void,
  enabled = true
) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connectSSE = useCallback(() => {
    if (!enabled || !applicationPublicId || eventSourceRef.current) return;

    try {
      const url = new URL("/api/portal/jobs/messages/stream", window.location.origin);
      url.searchParams.set("applicationPublicId", applicationPublicId);

      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data) as StreamMessage;
          if (data.type === "messages") {
            onMessages(data.messages);
          }
        } catch {
          // Ignore parse errors
        }
      });

      eventSource.addEventListener("error", () => {
        eventSource.close();
        eventSourceRef.current = null;
        // Fallback to polling if SSE fails
        setupFallbackPolling();
      });
    } catch {
      // SSE not supported or failed, use fallback
      setupFallbackPolling();
    }
  }, [applicationPublicId, enabled, onMessages]);

  const setupFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current || !applicationPublicId) return;

    // Fallback: Poll every 500ms (faster than original 1500ms)
    fallbackIntervalRef.current = setInterval(async () => {
      try {
        const url = new URL("/api/portal/jobs/messages", window.location.origin);
        url.searchParams.set("applicationPublicId", applicationPublicId);
        url.searchParams.set("sinceIso", new Date(0).toISOString());

        const res = await fetch(url.toString(), {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean; messages?: PortalJobMessage[] };
          if (data.messages?.length) {
            onMessages(data.messages);
          }
        }
      } catch {
        // Ignore fetch errors
      }
    }, 500);
  }, [applicationPublicId, onMessages]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    // Start SSE connection
    connectSSE();

    // Reconnect on focus if connection was lost
    const handleFocus = () => {
      if (!eventSourceRef.current && !fallbackIntervalRef.current) {
        connectSSE();
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      disconnect();
    };
  }, [enabled, connectSSE, disconnect]);

  return { disconnect };
}
