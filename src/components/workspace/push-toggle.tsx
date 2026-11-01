"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/app/portal/workspace-actions";
import { BTN, BTN_SOFT } from "@/components/workspace/ws-ui";

const SW = "/share-push-sw.js";

function keyBytes(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle() {
  const vapid = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const supported = useSyncExternalStore(
    () => () => {},
    () => "serviceWorker" in navigator && "PushManager" in window && Boolean(vapid),
    () => false,
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!supported) return;
    void navigator.serviceWorker.getRegistration(SW).then((reg) => reg?.pushManager.getSubscription().then((s) => setEnabled(Boolean(s))));
  }, [supported]);

  async function turnOn() {
    setBusy(true);
    setMsg("");
    try {
      const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent);
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
      if (ios && !standalone) throw new Error("On iPhone, add the portal to your Home Screen first, then turn on alerts from there.");
      if (Notification.permission === "denied") throw new Error("Notifications are blocked. Allow them in the browser settings.");
      if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") {
        throw new Error("Notifications were not allowed.");
      }
      await navigator.serviceWorker.register(SW);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid) as BufferSource });
      const res = await savePushSubscriptionAction(sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } });
      if (!res.ok) throw new Error(res.message);
      setEnabled(true);
      setMsg("Alerts are on for this device.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not turn on alerts.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
      setMsg("Alerts are off for this device.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return <p className="text-dash-muted-foreground text-sm">Phone alerts are not available in this browser. You still get emails.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy} onClick={() => void (enabled ? turnOff() : turnOn())} className={enabled ? BTN_SOFT : BTN}>
        {busy ? "Please wait…" : enabled ? "Turn off phone alerts" : "Turn on phone alerts"}
      </button>
      {msg ? <span className="text-dash-muted-foreground text-sm">{msg}</span> : null}
    </div>
  );
}
