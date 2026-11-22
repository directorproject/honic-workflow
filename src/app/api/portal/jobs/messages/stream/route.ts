import { NextResponse, type NextRequest } from "next/server";
import { isStaffUser } from "@/lib/auth-staff";
import { getPortalUser } from "@/lib/portal/data";
import { listMessagesSinceForApplicationPublicId } from "@/lib/portal/jobs";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-Sent Events (SSE) for real-time job messages - instant delivery like WhatsApp */
export async function GET(request: NextRequest) {
  const user = await getPortalUser();
  if (!user || isStaffUser(user)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });

  const applicationPublicId = String(request.nextUrl.searchParams.get("applicationPublicId") ?? "");
  if (!applicationPublicId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Create a ReadableStream for SSE
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastCheck = new Date().toISOString();
      let isConnected = true;

      // Send initial "connection established" message
      controller.enqueue(encoder.encode("data: {\"type\":\"connected\"}\n\n"));

      // Poll for new messages every 500ms instead of 1500ms (3x faster)
      const pollInterval = setInterval(async () => {
        if (!isConnected) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const res = await listMessagesSinceForApplicationPublicId(
            db,
            applicationPublicId,
            user.id,
            lastCheck
          );

          if (res?.messages && res.messages.length > 0) {
            lastCheck = new Date().toISOString();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "messages", messages: res.messages })}\n\n`)
            );
          }
        } catch (err) {
          console.error("SSE poll error:", err);
        }
      }, 500); // Poll every 500ms instead of 1500ms

      // Keep connection alive with heartbeat every 10 seconds
      const heartbeat = setInterval(() => {
        if (!isConnected) {
          clearInterval(heartbeat);
          return;
        }
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 10000);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        isConnected = false;
        clearInterval(pollInterval);
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Prevent proxy buffering
    },
  });
}
