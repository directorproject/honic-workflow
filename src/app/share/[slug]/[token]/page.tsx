import { notFound } from "next/navigation";

import { ProjectShareView } from "@/components/share/project-share-view";
import { resolveShareTokenWithClientSlug } from "@/lib/project-share";
import { loadProjectDetail } from "@/lib/projects-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PublicShareProjectPage(props: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await props.params;
  const resolved = await resolveShareTokenWithClientSlug(token, slug);
  if (!resolved.ok) {
    notFound();
  }

  const { project, error } = await loadProjectDetail(resolved.projectId, { includeRegisteredClientContact: false });
  if (!project) {
    notFound();
  }

  return <ProjectShareView project={project} error={error} slug={slug} token={token} />;
}
