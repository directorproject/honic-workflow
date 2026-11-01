"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseAdminClient } from "@/lib/supabase-server";

function revalidateClientPages() {
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/projects/new");
  revalidatePath("/plans");
  revalidatePath("/");
}

export async function createRegisteredClientAction(name: string, phone: string | null = null) {
  const clean = String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!clean) throw new Error("Enter the client name.");
  const cleanPhone = String(phone ?? "").trim().slice(0, 40);

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Database not configured.");

  const { error } = await supabase
    .from("registered_clients")
    .insert({ name: clean, phone: cleanPhone.length > 0 ? cleanPhone : null });
  if (error) {
    if (error.code === "23505") throw new Error(`A client named "${clean}" already exists.`);
    throw new Error(error.message);
  }

  revalidateClientPages();
}

export async function setRegisteredClientHiddenAction(clientId: string, hidden: boolean) {
  const id = String(clientId ?? "").trim();
  if (!id) throw new Error("Missing client id.");

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Database not configured.");

  const payload = {
    is_hidden: hidden,
    hidden_at: hidden ? new Date().toISOString() : null,
  };

  const { error } = await supabase.from("registered_clients").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidateClientPages();
}

export async function setRegisteredClientBlockedAction(
  clientId: string,
  blocked: boolean,
  reason: string | null = null,
) {
  const id = String(clientId ?? "").trim();
  if (!id) throw new Error("Missing client id.");

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Database not configured.");

  const note = String(reason ?? "").trim().slice(0, 500);
  const payload = {
    is_blocked: blocked,
    blocked_at: blocked ? new Date().toISOString() : null,
    blocked_reason: blocked ? (note.length > 0 ? note : null) : null,
  };

  const { error } = await supabase.from("registered_clients").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidateClientPages();
}

type DeleteRpcResult = { ok?: boolean; error?: string; project_count?: number };

export async function deleteRegisteredClientFromManageAction(clientId: string) {
  const id = String(clientId ?? "").trim();
  if (!id) throw new Error("Missing client id.");

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Database not configured.");

  const { data, error } = await supabase.rpc("delete_registered_client", { p_client_id: id });
  if (error) throw new Error(error.message);

  const result = (data ?? {}) as DeleteRpcResult;
  if (result.ok) {
    revalidateClientPages();
    return;
  }
  if (result.error === "has_projects") {
    throw new Error(`Cannot delete: ${result.project_count ?? 1} project(s) still use this client.`);
  }
  if (result.error === "not_found") {
    throw new Error("Client not found.");
  }
  throw new Error(result.error ?? "Delete failed.");
}
