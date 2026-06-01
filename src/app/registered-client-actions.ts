"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type DeleteRegisteredClientState =
  | { ok: true }
  | { ok: false; message: string }
  | null;

type DeleteRpcResult = { ok?: boolean; error?: string; project_count?: number };

export async function deleteRegisteredClientAction(
  clientId: string,
  _prev: DeleteRegisteredClientState,
): Promise<DeleteRegisteredClientState> {
  const id = clientId.trim();
  if (!id) {
    return { ok: false, message: "Missing client id." };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, message: "Database not configured." };
  }

  const { data, error } = await supabase.rpc("delete_registered_client", {
    p_client_id: id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const result = (data ?? {}) as DeleteRpcResult;
  if (!result.ok) {
    if (result.error === "has_invoices") {
      return {
        ok: false,
        message: "Cannot delete: an invoice still uses this client name. Delete those invoices first.",
      };
    }
    if (result.error === "has_projects") {
      const n = typeof result.project_count === "number" ? result.project_count : 1;
      return {
        ok: false,
        message: `Cannot delete: ${n} tracked project(s) use this client. Remove or reassign them first.`,
      };
    }
    if (result.error === "not_found") {
      return { ok: false, message: "Client not found (may already be deleted)." };
    }
    return { ok: false, message: result.error ?? "Delete was not allowed." };
  }

  revalidatePath("/projects");
  revalidatePath("/projects/new");
  revalidatePath("/plans");
  revalidatePath("/");
  return { ok: true };
}
