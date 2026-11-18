import { NextResponse } from "next/server";

import { getPortalUser } from "@/lib/portal/data";
import { getDocByPublicId, getPostPaperPath, isGroupMember } from "@/lib/portal/zimamoto";
import { getGroupMessageFile } from "@/lib/portal/zimamoto-chat";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id")?.trim();
  if (!id || (kind !== "post" && kind !== "doc" && kind !== "message")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const user = await getPortalUser();
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  let storagePath: string | null = null;
  let fileName = "download";
  let groupId: string | null = null;

  if (kind === "message") {
    // Chat attachments: members of the group only, for as long as the group exists.
    const meta = await getGroupMessageFile(db, id);
    if (!meta) return NextResponse.json({ error: "File not found." }, { status: 404 });
    if (!user) return NextResponse.json({ error: "Sign in to open group files." }, { status: 401 });
    const allowed = await isGroupMember(db, meta.groupId, user.id);
    if (!allowed) return NextResponse.json({ error: "You are not in this group." }, { status: 403 });
    storagePath = meta.storagePath;
    fileName = meta.fileName;
  } else if (kind === "post") {
    const meta = await getPostPaperPath(db, id);
    if (!meta) return NextResponse.json({ error: "File not found." }, { status: 404 });
    storagePath = meta.storagePath;
    groupId = meta.groupId;
    if (groupId) {
      if (!user) return NextResponse.json({ error: "Sign in to download group papers." }, { status: 401 });
      const allowed = await isGroupMember(db, groupId, user.id);
      if (!allowed) return NextResponse.json({ error: "You are not in this group." }, { status: 403 });
    } else if (!user) {
      return NextResponse.json({ error: "Sign in to download papers." }, { status: 401 });
    }
  } else {
    const meta = await getDocByPublicId(db, id);
    if (!meta) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    storagePath = meta.storagePath;
    groupId = meta.groupId;
    fileName = meta.fileName;
    if (!user) return NextResponse.json({ error: "Sign in to open group documents." }, { status: 401 });
    const allowed = await isGroupMember(db, groupId, user.id);
    if (!allowed) return NextResponse.json({ error: "You are not in this group." }, { status: 403 });
  }

  const { data, error } = await db.storage.from(STORAGE_BUCKET).download(storagePath!);
  if (error || !data) return NextResponse.json({ error: "Could not read the file." }, { status: 404 });

  const bytes = await data.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}