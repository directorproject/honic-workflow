import { Readable } from "node:stream";

import { streamDriveFileContent } from "@/lib/google-drive-server";
import { getSessionActor } from "@/lib/workspace/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  // Staff only, enforced here as well as in middleware (defence in depth).
  const actor = await getSessionActor();
  if (actor?.kind !== "staff") {
    return new Response("Staff only.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const { fileId: rawId } = await context.params;
  const fileId = decodeURIComponent(rawId);

  const url = new URL(request.url);
  const asAttachment =
    url.searchParams.get("download") === "1" || url.searchParams.get("disposition") === "attachment";

  const result = await streamDriveFileContent(fileId);
  if (!result.ok) {
    return new Response(result.error, {
      status: result.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const webStream = Readable.toWeb(result.stream as Readable);
  const safeName = result.filename.replace(/[\r\n"]/g, "_");
  const disposition = asAttachment ? "attachment" : "inline";

  return new Response(webStream as unknown as BodyInit, {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, max-age=0",
    },
  });
}
