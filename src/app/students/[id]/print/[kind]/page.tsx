import { notFound } from "next/navigation";

import { PRINT_KINDS, WorkspacePrint, type PrintKind } from "@/components/workspace/workspace-print";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { loadWorkspaceBundle } from "@/lib/workspace/load";
import { readableWorkspaceId } from "@/lib/workspace/resolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Student report · Honic" };

export default async function StaffPrintPage(props: {
  params: Promise<{ id: string; kind: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const [{ id, kind }, sp] = await Promise.all([props.params, props.searchParams]);
  if (!(PRINT_KINDS as string[]).includes(kind)) notFound();
  const workspaceId = await readableWorkspaceId({ workspaceId: id, staffOnly: true });
  const db = getSupabaseAdminClient();
  const bundle = workspaceId && db ? await loadWorkspaceBundle(db, workspaceId) : null;
  if (!bundle) notFound();
  return <WorkspacePrint bundle={bundle} kind={kind as PrintKind} period={sp.period === "month" ? "month" : "week"} />;
}
