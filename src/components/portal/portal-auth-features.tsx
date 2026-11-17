import Link from "next/link";

const FEATURES = [
  { label: "Workspace home", desc: "Progress and next steps", href: "/portal/home" },
  { label: "Gantt chart", desc: "Timeline and milestones", href: "/portal/home?tab=gantt" },
  { label: "Calendar", desc: "Deadlines and field days", href: "/portal/home?tab=calendar" },
  { label: "Field study", desc: "Visits, notes and evidence", href: "/portal/home?tab=field" },
  { label: "Review", desc: "Drafts and corrections", href: "/portal/home?tab=review" },
  { label: "Project files", desc: "Reports and uploads", href: "/portal/home?tab=files" },
  { label: "Team & supervisor", desc: "Partners and supervisor", href: "/portal/home?tab=team" },
  { label: "Literature review", desc: "Titles and briefs", href: "/portal/titles" },
  { label: "Jobs", desc: "Post or apply for work", href: "/portal/jobs" },
  { label: "Zimamoto", desc: "Papers, groups, libraries", href: "/portal/zimamoto" },
  { label: "Plans & access", desc: "Desk membership", href: "/portal/packs" },
  { label: "Help desk", desc: "Message Honic staff", href: "/portal/home?tab=messages" },
  { label: "My projects", desc: "Titles and claims", href: "/portal/home?tab=projects" },
  { label: "Payments", desc: "Invoices and history", href: "/portal/home?tab=payments" },
  { label: "My account", desc: "Profile and course", href: "/portal/home?tab=account" },
] as const;

function signInHref(target: string): string {
  return `/portal?auth=signin&next=${encodeURIComponent(target)}`;
}

export function PortalAuthFeaturesHeader() {
  return (
    <section className="border-dash-border bg-dash-card mb-6 overflow-hidden rounded-2xl border shadow-sm">
      <div className="border-dash-border border-b bg-gradient-to-br from-[color-mix(in_oklab,var(--dash-accent)_12%,transparent)] to-transparent px-4 py-5 sm:px-6 sm:py-6">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">Honic Nexis</p>
        <h2 className="text-dash-foreground mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Everything in one portal</h2>
        <p className="text-dash-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
          Create a free account or sign in to open any feature below. Literature browse, Jobs, and Zimamoto are free; Nexis
          Desk tools unlock with a paid plan.
        </p>
      </div>
      <ul className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.href} className="border-dash-border border-b border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0">
            <Link
              href={signInHref(f.href)}
              className="hover:bg-dash-muted/40 flex h-full flex-col px-4 py-3.5 transition sm:px-5"
            >
              <span className="text-dash-foreground text-sm font-semibold">{f.label}</span>
              <span className="text-dash-muted-foreground mt-0.5 text-xs leading-snug">{f.desc}</span>
              <span className="text-dash-accent mt-2 text-[11px] font-semibold">Sign in to open →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}