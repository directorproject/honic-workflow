import { getSupabaseAdminClient } from "@/lib/supabase-server";

export type LastYearProject = {
  id: string;
  programme: "ETE" | "COE";
  source: string;
  panel: string | null;
  serialNo: number | null;
  regNo: string | null;
  studentName: string | null;
  title: string;
  supervisor: string | null;
};

export const TITLE_PROPOSAL_STATUSES = ["available", "reserved", "assigned", "dropped"] as const;
export type TitleProposalStatus = (typeof TITLE_PROPOSAL_STATUSES)[number];

export type TitleProposal = {
  id: string;
  batch: string | null;
  originRef: string | null;
  originalTitle: string | null;
  title: string;
  summary: string | null;
  hardware: string | null;
  communication: string | null;
  status: TitleProposalStatus;
  assignedTo: string | null;
  assignedAt: string | null;
  notes: string | null;
  createdAt: string;
};

export type TitleBankData = {
  lastYear: LastYearProject[];
  proposals: TitleProposal[];
  error: string | null;
};

function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return s.length > 0 ? s : null;
}

function toStatus(v: unknown): TitleProposalStatus {
  return (TITLE_PROPOSAL_STATUSES as readonly string[]).includes(String(v))
    ? (v as TitleProposalStatus)
    : "available";
}

export async function loadTitleBank(): Promise<TitleBankData> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { lastYear: [], proposals: [], error: "Database not configured." };

  const [ly, tp] = await Promise.all([
    supabase
      .from("last_year_projects")
      .select("id, programme, source, panel, serial_no, reg_no, student_name, title, supervisor")
      .order("programme", { ascending: false })
      .order("panel", { ascending: true, nullsFirst: false })
      .order("serial_no", { ascending: true }),
    supabase
      .from("title_proposals")
      .select(
        "id, batch, origin_ref, original_title, title, summary, hardware, communication, status, assigned_to, assigned_at, notes, created_at",
      )
      .order("created_at", { ascending: true }),
  ]);

  const error = ly.error?.message ?? tp.error?.message ?? null;

  const lastYear: LastYearProject[] = (ly.data ?? []).map((r) => ({
    id: String(r.id),
    programme: r.programme === "COE" ? "COE" : "ETE",
    source: String(r.source ?? ""),
    panel: str(r.panel),
    serialNo: typeof r.serial_no === "number" ? r.serial_no : null,
    regNo: str(r.reg_no),
    studentName: str(r.student_name),
    title: String(r.title ?? ""),
    supervisor: str(r.supervisor),
  }));

  const proposals: TitleProposal[] = (tp.data ?? []).map((r) => ({
    id: String(r.id),
    batch: str(r.batch),
    originRef: str(r.origin_ref),
    originalTitle: str(r.original_title),
    title: String(r.title ?? ""),
    summary: str(r.summary),
    hardware: str(r.hardware),
    communication: str(r.communication),
    status: toStatus(r.status),
    assignedTo: str(r.assigned_to),
    assignedAt: str(r.assigned_at),
    notes: str(r.notes),
    createdAt: String(r.created_at ?? ""),
  }));

  return { lastYear, proposals, error };
}
