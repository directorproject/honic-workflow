import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership, getSessionActor, supervisorCanAccessWorkspace } from "@/lib/workspace/access";
import { STORAGE_BUCKET } from "@/lib/workspace/constants";
import { buildExport } from "@/lib/workspace/export";
import { loadWorkspaceBundle } from "@/lib/workspace/load";

/** Workspace id for a supervisor link, or null when the link is unknown or turned off. */
export async function workspaceIdForSupervisorToken(token: string | null | undefined): Promise<string | null> {
  if (!token || token.length > 64) return null;
  const db = getSupabaseAdminClient();
  if (!db) return null;
  const { data } = await db
    .from("portal_workspaces")
    .select("id, supervisor_link_enabled")
    .eq("supervisor_token", token)
    .maybeSingle();
  return data?.supervisor_link_enabled ? String(data.id) : null;
}

/** Workspace the caller may read: staff, student member, supervisor account (by email), or magic token. */
export async function readableWorkspaceId(opts: {
  workspaceId?: string;
  token?: string | null;
  staffOnly?: boolean;
}): Promise<string | null> {
  if (opts.token && !opts.staffOnly) return workspaceIdForSupervisorToken(opts.token);
  const actor = await getSessionActor();
  if (!actor) return null;
  if (actor.kind === "staff") return opts.workspaceId ?? null;
  if (opts.staffOnly) return null;
  if (actor.kind === "supervisor") {
    const id = opts.workspaceId;
    if (!id) return null;
    const ok = await supervisorCanAccessWorkspace(actor.db, actor.userId, actor.email, id);
    return ok ? id : null;
  }
  const m = await findMembership(actor.db, actor.userId);
  if (m && (!opts.workspaceId || m.workspaceId === opts.workspaceId)) return m.workspaceId;
  // Same person may supervise another team by email.
  if (opts.workspaceId) {
    const ok = await supervisorCanAccessWorkspace(actor.db, actor.userId, actor.email, opts.workspaceId);
    if (ok) return opts.workspaceId;
  }
  return null;
}

export async function fileResponse(workspaceId: string, fileId: string, inline: boolean): Promise<Response> {
  const db = getSupabaseAdminClient();
  if (!db || !/^[0-9a-f-]{36}$/i.test(fileId)) return new NextResponse("Not found.", { status: 404 });
  const { data: f } = await db
    .from("portal_files")
    .select("name, storage_path, mime_type")
    .eq("id", fileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!f) return new NextResponse("Not found.", { status: 404 });

  // Stream inline so the paper viewer can mark up the PDF on the same origin (no CORS).
  if (inline) {
    const { data: blob, error } = await db.storage.from(STORAGE_BUCKET).download(String(f.storage_path));
    if (error || !blob) return new NextResponse("File not available.", { status: 404 });
    const mime =
      (f.mime_type as string | null) ||
      (/\.pdf$/i.test(String(f.name)) ? "application/pdf" : "application/octet-stream");
    const bytes = await blob.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${String(f.name).replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  const { data, error } = await db.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(String(f.storage_path), 120, { download: String(f.name) });
  if (error || !data) return new NextResponse("File not available.", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}

export async function exportResponse(workspaceId: string, kind: string): Promise<Response> {
  const db = getSupabaseAdminClient();
  if (!db) return new NextResponse("Unavailable.", { status: 503 });
  const bundle = await loadWorkspaceBundle(db, workspaceId);
  const out = bundle ? buildExport(bundle, kind) : null;
  if (!out) return new NextResponse("Not found.", { status: 404 });
  return new NextResponse(out.body, {
    headers: {
      "Content-Type": out.type,
      "Content-Disposition": `attachment; filename="${out.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
