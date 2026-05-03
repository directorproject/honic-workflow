import { randomBytes } from "node:crypto";

import { assertDescendantOfFolder, getDriveApi } from "@/lib/google-drive-server";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

import { shareLinkPathClientSlug } from "@/lib/share-link-origin";
import { loadProjectDetail } from "@/lib/projects-data";

const TOKEN_BYTES = 24;

/** Hex length of `generateShareToken()` output (bytes × 2). */
export const SHARE_LINK_TOKEN_HEX_LENGTH = TOKEN_BYTES * 2;

export function generateShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/** True when `segment` looks like a legacy `/share/{token}` path (single hex token). */
export function isLegacyShareTokenPathSegment(segment: string): boolean {
  const s = segment.trim();
  return s.length === SHARE_LINK_TOKEN_HEX_LENGTH && /^[a-f0-9]+$/i.test(s);
}

export async function createProjectShareLink(params: {
  trackedProjectId: string;
  label?: string | null;
  expiresAt?: Date | null;
}): Promise<{ ok: true; token: string; alreadyExisted: boolean } | { ok: false; error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Database not configured." };
  }

  const { data: existingRows, error: readErr } = await supabase
    .from("project_share_links")
    .select("token")
    .eq("tracked_project_id", params.trackedProjectId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (readErr) {
    return { ok: false, error: readErr.message };
  }
  const existingToken = existingRows?.[0]?.token as string | undefined;
  if (existingToken) {
    return { ok: true, token: existingToken, alreadyExisted: true };
  }

  const token = generateShareToken();
  const { error } = await supabase.from("project_share_links").insert({
    tracked_project_id: params.trackedProjectId,
    token,
    label: params.label?.trim() || null,
    expires_at: params.expiresAt?.toISOString() ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      const { data: rows } = await supabase
        .from("project_share_links")
        .select("token")
        .eq("tracked_project_id", params.trackedProjectId)
        .order("created_at", { ascending: true })
        .limit(1);
      const t = rows?.[0]?.token as string | undefined;
      if (t) {
        return { ok: true, token: t, alreadyExisted: true };
      }
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, token, alreadyExisted: false };
}

export async function resolveShareTokenToProjectId(
  token: string,
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const raw = token.trim();
  if (!raw || raw.length < 32) {
    return { ok: false, error: "Invalid link." };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Database not configured." };
  }

  const { data, error } = await supabase
    .from("project_share_links")
    .select("tracked_project_id, expires_at")
    .eq("token", raw)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "This link is not valid or has been removed." };
  }

  if (data.expires_at) {
    const exp = new Date(data.expires_at as string);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      return { ok: false, error: "This link has expired." };
    }
  }

  return { ok: true, projectId: data.tracked_project_id as string };
}

/**
 * Validates share URL `/share/{clientSlug}/{token}`: token must exist and slug must match the project’s client.
 */
export async function resolveShareTokenWithClientSlug(
  token: string,
  clientSlug: string,
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const resolved = await resolveShareTokenToProjectId(token);
  if (!resolved.ok) return resolved;

  const { project } = await loadProjectDetail(resolved.projectId);
  if (!project) {
    return { ok: false, error: "This link is not valid or has been removed." };
  }

  const expected = shareLinkPathClientSlug(project.registered_clients);
  const got = decodeURIComponent(clientSlug).trim().toLowerCase();
  if (got !== expected.toLowerCase()) {
    return { ok: false, error: "This link is not valid or has been removed." };
  }

  return { ok: true, projectId: resolved.projectId };
}

/**
 * Confirms a Drive file sits under the project’s linked folder (for token-scoped file access).
 */
export async function assertShareFileInProjectFolder(
  projectDriveFolderId: string,
  fileId: string,
): Promise<boolean> {
  const api = await getDriveApi(["https://www.googleapis.com/auth/drive.readonly"]);
  if (!api.ok) return false;
  return assertDescendantOfFolder(api.drive, projectDriveFolderId, fileId);
}

export type ProjectShareLinkRow = {
  id: string;
  token: string;
  created_at: string;
  expires_at: string | null;
  label: string | null;
};

export async function listShareLinksForProject(projectId: string): Promise<ProjectShareLinkRow[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("project_share_links")
    .select("id, token, created_at, expires_at, label")
    .eq("tracked_project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return [];
  return (data ?? []) as ProjectShareLinkRow[];
}
