"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { TITLE_PROPOSAL_STATUSES, type TitleProposalStatus } from "@/lib/title-bank";

function db() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("Database not configured.");
  return supabase;
}

function text(v: unknown, max = 2000): string | null {
  const s = String(v ?? "").trim().slice(0, max);
  return s.length > 0 ? s : null;
}

function requireId(v: unknown): string {
  const id = String(v ?? "").trim();
  if (!id) throw new Error("Missing id.");
  return id;
}

export async function setTitleProposalStatusAction(
  proposalId: string,
  status: TitleProposalStatus,
  assignedTo: string | null = null,
) {
  const id = requireId(proposalId);
  if (!TITLE_PROPOSAL_STATUSES.includes(status)) throw new Error("Invalid status.");

  const holder = status === "reserved" || status === "assigned" ? text(assignedTo, 200) : null;
  if ((status === "reserved" || status === "assigned") && !holder) {
    throw new Error("Enter who the title is for.");
  }

  const { error } = await db()
    .from("title_proposals")
    .update({
      status,
      assigned_to: holder,
      assigned_at: holder ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/titles");
}

export type NewTitleProposalInput = {
  title: string;
  originalTitle?: string | null;
  originRef?: string | null;
  summary?: string | null;
  hardware?: string | null;
  communication?: string | null;
};

export async function createTitleProposalAction(input: NewTitleProposalInput) {
  const title = text(input.title, 300);
  if (!title) throw new Error("Enter the new title.");

  const { error } = await db()
    .from("title_proposals")
    .insert({
      title,
      batch: "Added on dashboard",
      original_title: text(input.originalTitle, 300),
      origin_ref: text(input.originRef, 100) ?? "New idea",
      summary: text(input.summary),
      hardware: text(input.hardware),
      communication: text(input.communication),
    });
  if (error) throw new Error(error.message);

  revalidatePath("/titles");
}

export async function deleteTitleProposalAction(proposalId: string) {
  const id = requireId(proposalId);
  const { error } = await db().from("title_proposals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/titles");
}

export async function deleteLastYearProjectAction(projectId: string) {
  const id = requireId(projectId);
  const { error } = await db().from("last_year_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/titles");
}
