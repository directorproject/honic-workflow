import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { findMembership, getSessionActor } from "@/lib/workspace/access";
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

/** Workspace the caller may read: staff (any, by id), student (their own), or supervisor token. */
export async function readableWorkspaceId(opts: { workspaceId?: string; token?: string | null; staffOnly?: boolean }): Promise<string | null> {
  if (opts.token && !opts.staffOnly) return workspaceIdForSupervisorToken(opts.token);
  const actor = await getSessionActor();
  if (!actor) return null;
  if (actor.kind === "staff") return opts.workspaceId ?? null;
  if (opts.staffOnly) return null;
  const m = await findMembership(actor.db, actor.userId);
  return m?.workspaceId ?? null;
}

export async function fileResponse(workspaceId: string, fileId: string, inline: boolean): Promise<Response> {
  const db = getSupabaseAdminClient();
  if (!db || !/^[0-9a-f-]{36}$/i.test(fileId)) return new NextResponse("Not found.", { status: 404 });
  const { data: f } = await db
    .from("portal_files")
    .select("name, storage_path")
    .eq("id", fileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!f) return new NextResponse("Not found.", { status: 404 });
  const { data, error } = await db.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(String(f.storage_path), 120, inline ? undefined : { download: String(f.name) });
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
