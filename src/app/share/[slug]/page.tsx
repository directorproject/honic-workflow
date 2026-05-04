import { notFound, redirect } from "next/navigation";

import { isLegacyShareTokenPathSegment, resolveShareTokenToProjectId } from "@/lib/project-share";
import { loadProjectDetail } from "@/lib/projects-data";
import { buildShareProjectRelativePath, shareLinkPathClientSlug } from "@/lib/share-link-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Legacy `/share/{token}` (one segment) → `/share/{clientSlug}/{token}`. */
export default async function LegacyShareProjectRedirectPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  if (!isLegacyShareTokenPathSegment(slug)) {
    notFound();
  }

  const resolved = await resolveShareTokenToProjectId(slug);
  if (!resolved.ok) {
    notFound();
  }

  const { project } = await loadProjectDetail(resolved.projectId, { includeRegisteredClientContact: false });
  if (!project) {
    notFound();
  }

  const clientSlug = shareLinkPathClientSlug(project.registered_clients);
  redirect(buildShareProjectRelativePath(clientSlug, slug));
}
