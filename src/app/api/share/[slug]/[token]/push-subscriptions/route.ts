import { NextResponse } from "next/server";

import { resolveShareTokenWithClientSlug } from "@/lib/project-share";
import { removeSharePushSubscription, upsertSharePushSubscription } from "@/lib/share-push";
import { isWebPushConfigured } from "@/lib/web-push-server";

type Params = { slug: string; token: string };

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  if (!isWebPushConfigured()) return bad("Push is not configured.", 503);

  const { slug, token } = await ctx.params;
  const resolved = await resolveShareTokenWithClientSlug(token, slug);
  if (!resolved.ok) return bad(resolved.error, 401);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return bad("Invalid JSON body.");
  }

  const rec = payload as Record<string, unknown>;
  const endpoint = String(rec.endpoint ?? "").trim();
  const keys = (rec.keys ?? {}) as Record<string, unknown>;
  const p256dh = String(keys.p256dh ?? "").trim();
  const auth = String(keys.auth ?? "").trim();

  if (!endpoint || !p256dh || !auth) {
    return bad("Missing subscription endpoint/keys.");
  }

  const save = await upsertSharePushSubscription({
    trackedProjectId: resolved.projectId,
    shareToken: token,
    endpoint,
    keys: { p256dh, auth },
    userAgent: req.headers.get("user-agent"),
  });
  if (!save.ok) return bad(save.error, 500);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<Params> }) {
  const { slug, token } = await ctx.params;
  const resolved = await resolveShareTokenWithClientSlug(token, slug);
  if (!resolved.ok) return bad(resolved.error, 401);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return bad("Invalid JSON body.");
  }

  const endpoint = String((payload as Record<string, unknown>).endpoint ?? "").trim();
  if (!endpoint) return bad("Missing endpoint.");

  const out = await removeSharePushSubscription(resolved.projectId, endpoint);
  if (!out.ok) return bad(out.error, 500);
  return NextResponse.json({ ok: true });
}
