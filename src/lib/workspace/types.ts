/** Row shapes of the portal_* tables (snake_case, as stored). */

export type ActorKind = "student" | "staff" | "supervisor";

export type Workspace = {
  id: string;
  name: string;
  title_proposal_id: string | null;
  project_category: string | null;
  problem_statement: string | null;
  objectives: string | null;
  scope: string | null;
  methodology: string | null;
  expected_results: string | null;
  technologies: string | null;
  start_date: string | null;
  end_date: string | null;
  defence_date: string | null;
  supervisor_name: string | null;
  supervisor_email: string | null;
  supervisor_phone: string | null;
  supervisor_meetings: string | null;
  budget_tsh: number | null;
  supervisor_token: string | null;
  supervisor_link_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
};

export type Member = {
  user_id: string;
  role: "leader" | "member";
  joined_at: string;
  full_name: string;
  email: string | null;
  institution: string | null;
  course: string | null;
};

export type Invite = { id: string; email: string; token: string; created_at: string; accepted_at: string | null };

export type Phase = { id: string; name: string; color: string; sort_order: number };

export type ChecklistItem = { text: string; done: boolean };

export type Task = {
  id: string;
  phase_id: string | null;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "done";
  priority: "low" | "normal" | "high";
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  is_milestone: boolean;
  depends_on: string[];
  checklist: ChecklistItem[];
  sort_order: number;
  completed_at: string | null;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  kind: "meeting" | "deadline" | "presentation" | "other";
  title: string;
  starts_on: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
};

export type SharedDeadline = {
  id: string;
  title: string;
  due_date: string;
  institution: string | null;
  course_code: string | null;
  project_category: string | null;
  notes: string | null;
};

export type DocumentItem = {
  id: string;
  name: string;
  status: "not_started" | "draft" | "submitted" | "changes" | "approved";
  due_date: string | null;
  notes: string | null;
  /** What changed since last feedback — print this for the supervisor, not the whole report. */
  change_summary: string | null;
  /** Student marks this item visible to the supervisor now. */
  shared_with_supervisor: boolean;
  /** Parent document when this row is a page-range partial. */
  parent_id: string | null;
  page_from: number | null;
  page_to: number | null;
  sort_order: number;
  updated_at: string;
};

export type ReviewMarkKind = "comment" | "draw" | "general" | "highlight";

export type ReviewStroke = {
  color: string;
  width: number;
  points: { x: number; y: number }[];
};

export type ReviewMark = {
  id: string;
  document_id: string;
  author_kind: ActorKind;
  author_name: string;
  kind: ReviewMarkKind;
  page_number: number | null;
  /** Normalized 0..1 pin on the page so the note sits on the paper. */
  pin_x: number | null;
  pin_y: number | null;
  body: string | null;
  strokes: ReviewStroke[];
  created_at: string;
};

export type FileItem = {
  id: string;
  document_id: string | null;
  event_id: string | null;
  folder: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  /** Place/site where the file was obtained (e.g. Muhimbili Hospital). */
  obtained_place: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

export type LogEntry = {
  id: string;
  entry_date: string;
  hours: number | null;
  work_done: string;
  problems: string | null;
  next_steps: string | null;
  author_name: string | null;
  created_at: string;
};

export type Dataset = {
  id: string;
  name: string;
  notes: string | null;
  columns: string[];
  rows: (string | number | null)[][];
  updated_at: string;
};

export type Part = {
  id: string;
  name: string;
  quantity: number;
  unit_price_tsh: number;
  status: "needed" | "ordered" | "bought";
  supplier: string | null;
  link: string | null;
  notes: string | null;
  sort_order: number;
};

export type Reference = {
  id: string;
  kind: "article" | "book" | "website" | "datasheet" | "thesis" | "other";
  authors: string | null;
  title: string;
  year: string | null;
  source: string | null;
  volume: string | null;
  pages: string | null;
  url: string | null;
  doi: string | null;
  accessed_on: string | null;
  notes: string | null;
};

export type Message = {
  id: string;
  author_kind: ActorKind;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  staff_read_at: string | null;
  student_read_at: string | null;
};

export type Booking = {
  id: string;
  kind: "meeting" | "lab" | "online";
  topic: string;
  preferred_at: string;
  duration_min: number;
  status: "requested" | "confirmed" | "declined" | "cancelled" | "done";
  confirmed_at: string | null;
  staff_note: string | null;
  requested_by_name: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  target_type: "document" | "logbook";
  target_id: string;
  author_kind: ActorKind;
  author_name: string;
  body: string;
  created_at: string;
};

export type Invoice = {
  id: string;
  description: string;
  amount_tsh: number;
  status: "quote" | "unpaid" | "paid" | "cancelled";
  due_date: string | null;
  reference: string | null;
  network: string | null;
  paid_at: string | null;
  created_at: string;
};

export type DefenceItem = {
  id: string;
  kind: "check" | "question";
  text: string;
  answer: string | null;
  done: boolean;
  sort_order: number;
};

export type Activity = { id: number; actor_name: string; action: string; created_at: string };

export type WorkspaceBundle = {
  workspace: Workspace;
  members: Member[];
  invites: Invite[];
  phases: Phase[];
  tasks: Task[];
  events: CalendarEvent[];
  deadlines: SharedDeadline[];
  documents: DocumentItem[];
  files: FileItem[];
  logbook: LogEntry[];
  datasets: Dataset[];
  parts: Part[];
  references: Reference[];
  messages: Message[];
  bookings: Booking[];
  comments: Comment[];
  reviewMarks: ReviewMark[];
  invoices: Invoice[];
  defence: DefenceItem[];
  activity: Activity[];
  /** Linked Honic-managed project, if staff linked a team member. */
  trackedProjectId: string | null;
  /** Workspace Project files quota from plan (250 MB free / 2 GB paid). */
  storageLimitBytes: number;
};

/** Who is looking at the workspace and what they may do. */
export type Viewer = {
  kind: ActorKind;
  userId: string | null;
  name: string;
  /** False for the supervisor link. */
  canEdit: boolean;
  /** Student Nexis Desk membership; staff/supervisor ignore this. */
  hasPaidDesk?: boolean;
};
