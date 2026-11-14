"use client";

import { useEffect, useMemo, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) out[i] = rawData.charCodeAt(i);
  return out;
}

type Props = {
  slug: string;
  token: string;
};

function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  return /iPad|iPhone|iPod/i.test(ua);
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  const navStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  return navStandalone || mediaStandalone;
}

async function waitForActiveServiceWorker(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  const readyPromise = navigator.serviceWorker.ready;
  const timeoutPromise = new Promise<never>((_, reject) =>
    window.setTimeout(() => reject(new Error("Service worker activation timed out.")), timeoutMs),
  );
  return Promise.race([readyPromise, timeoutPromise]);
}

export function SharePushToggle({ slug, token }: Props) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const vapidKey = useMemo(() => process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "", []);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    queueMicrotask(() => setSupported(ok && Boolean(vapidKey)));
    if (!ok) return;

    void navigator.serviceWorker.getRegistration("/share-push-sw.js").then((reg) => {
      if (!reg) return;
      void reg.pushManager.getSubscription().then((sub) => {
        setEnabled(Boolean(sub));
      });
    });
  }, [vapidKey]);

  async function subscribe() {
    setBusy(true);
    setMsg("");
    try {
      if (isIosLike() && !isStandaloneDisplayMode()) {
        throw new Error("On iPhone/iPad, open this page from Home Screen (Add to Home Screen) to enable push alerts.");
      }

      if (typeof Notification !== "undefined") {
        if (Notification.permission === "denied") {
          throw new Error("Notifications are blocked for this site. Enable them in browser settings.");
        }
        if (Notification.permission !== "granted") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            throw new Error("Notification permission not granted.");
          }
        }
      }

      await navigator.serviceWorker.register("/share-push-sw.js");
      const reg = await waitForActiveServiceWorker();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const save = await fetch(`/api/share/${encodeURIComponent(slug)}/${encodeURIComponent(token)}/push-subscriptions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      const json = (await save.json()) as { ok?: boolean; error?: string };
      if (!save.ok || !json.ok) throw new Error(json.error ?? "Failed to save subscription.");

      setEnabled(true);
      setMsg("Notifications enabled.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setMsg("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/share-push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();

      if (endpoint) {
        await fetch(`/api/share/${encodeURIComponent(slug)}/${encodeURIComponent(token)}/push-subscriptions`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      setEnabled(false);
      setMsg("Notifications disabled.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-dash-muted-foreground text-xs">
        Push updates are unavailable in this browser.
      </p>
    );
  }

  return (
    <div className="border-dash-border bg-dash-muted/30 mt-3 rounded-xl border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void (enabled ? unsubscribe() : subscribe())}
          disabled={busy}
          className="text-dash-foreground border-dash-border hover:border-dash-accent/50 inline-flex min-h-8 items-center rounded-md border px-3 text-xs font-semibold disabled:opacity-60"
        >
          {busy ? "Please wait..." : enabled ? "Disable update alerts" : "Enable update alerts"}
        </button>
        <span className="text-dash-muted-foreground text-xs">Get push notifications for status and file updates.</span>
      </div>
      {msg ? <p className="text-dash-muted-foreground mt-1 text-xs">{msg}</p> : null}
    </div>
  );
}
