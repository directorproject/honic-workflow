import { notFound, redirect } from "next/navigation";

import { isLegacyShareTokenPathSegment, resolveShareTokenToProjectId } from "@/lib/project-share";
import { buildShareProjectRelativePath, shareLinkPathClientSlug } from "@/lib/share-link-origin";
import { loadProjectDetail } from "@/lib/projects-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Legacy `/share/{token}/view/{fileId}` → canonical path with client slug. */
export default async function LegacyShareFileViewRedirectPage(props: {
  params: Promise<{ slug: string; fileId: string }>;
}) {
  const { slug, fileId: raw } = await props.params;
  if (!isLegacyShareTokenPathSegment(slug)) {
    notFound();
  }

  const resolved = await resolveShareTokenToProjectId(slug);
  if (!resolved.ok) {
    notFound();
  }

  const { project } = await loadProjectDetail(resolved.projectId);
  if (!project) {
    notFound();
  }

  const clientSlug = shareLinkPathClientSlug(project.registered_clients);
  const base = buildShareProjectRelativePath(clientSlug, slug);
  redirect(`${base}/view/${encodeURIComponent(raw)}`);
}
