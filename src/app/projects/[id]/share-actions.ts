"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireStaffActor } from "@/lib/auth-staff";
import { createProjectShareLink } from "@/lib/project-share";
import { loadProjectDetail } from "@/lib/projects-data";
import {
  buildShareProjectRelativePath,
  resolveShareLinkOriginForProjectFromHeaders,
  shareLinkPathClientSlug,
} from "@/lib/share-link-origin";
import { resolvePublicSiteBaseUrl } from "@/lib/site-url";

export type CreateShareLinkState =
  | { ok: true; url: string; alreadyExisted?: boolean }
  | { ok: false; message: string }
  | null;

async function inferBaseUrlFromRequest(): Promise<string> {
  const h = await headers();
  return resolvePublicSiteBaseUrl(h);
}

/** For building absolute share URLs in Server Components (e.g. link list). */
export async function getPublicSiteBaseUrl(): Promise<string> {
  return inferBaseUrlFromRequest();
}

export async function createClientShareLinkAction(
  projectId: string,
  prev: CreateShareLinkState,
  formData: FormData,
): Promise<CreateShareLinkState> {
  void prev;
  void formData;
  try {
    await requireStaffActor();
  } catch {
    return { ok: false, message: "Staff access required." };
  }
  const created = await createProjectShareLink({ trackedProjectId: projectId });
  if (!created.ok) {
    return { ok: false, message: created.error };
  }

  const h = await headers();
  const origin = await resolveShareLinkOriginForProjectFromHeaders(projectId, h);
  const { project } = await loadProjectDetail(projectId);
  const slug = shareLinkPathClientSlug(project?.registered_clients ?? null);
  const path = buildShareProjectRelativePath(slug, created.token);
  const url = origin ? `${origin.replace(/\/$/, "")}${path}` : path;

  revalidatePath(`/projects/${projectId}/work`);
  return { ok: true, url, alreadyExisted: created.alreadyExisted };
}
