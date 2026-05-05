import webpush from "web-push";

let configured = false;
let lastConfigKey = "";

function configureWebPushIfNeeded() {
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const composite = `${subject ?? ""}|${publicKey ?? ""}|${privateKey ?? ""}`;

  if (configured && composite === lastConfigKey) return;
  configured = true;
  lastConfigKey = composite;

  if (!subject || !publicKey || !privateKey) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() &&
      process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(),
  );
}

export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
  },
) {
  configureWebPushIfNeeded();
  if (!isWebPushConfigured()) {
    return { ok: false as const, error: "Web Push not configured." };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag ?? "project-update",
    vibrate: [120, 60, 120],
    silent: false,
  });

  try {
    await webpush.sendNotification(subscription, body, { TTL: 60 });
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push send failed.";
    return { ok: false as const, error: message };
  }
}
