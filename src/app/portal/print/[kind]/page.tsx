import { notFound } from "next/navigation";

import { PRINT_KINDS, WorkspacePrint, type PrintKind } from "@/components/workspace/workspace-print";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { loadWorkspaceBundle } from "@/lib/workspace/load";
import { readableWorkspaceId } from "@/lib/workspace/resolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Report · Honic student portal", robots: { index: false } };

export default async function PortalPrintPage(props: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ period?: string; t?: string }>;
}) {
  const [{ kind }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!(PRINT_KINDS as string[]).includes(kind)) notFound();
  const workspaceId = await readableWorkspaceId({ token: sp.t });
  const db = getSupabaseAdminClient();
  const bundle = workspaceId && db ? await loadWorkspaceBundle(db, workspaceId) : null;
  if (!bundle) notFound();
  return <WorkspacePrint bundle={bundle} kind={kind as PrintKind} period={sp.period === "month" ? "month" : "week"} />;
}
