import Link from "next/link";

import { countPendingClaims } from "@/lib/portal/title-claims";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { countUnreadHelpDesk } from "@/lib/workspace/load";

export async function HomeStudentsPanel() {
  const db = getSupabaseServiceRoleClient();
  const [pendingTitles, helpDeskUnread] = db
    ? await Promise.all([countPendingClaims(db).catch(() => 0), countUnreadHelpDesk(db).catch(() => 0)])
    : [0, 0];

  const cards = [
    {
      href: "/users",
      label: "Registered users",
      hint: "Portal accounts with secure public ids. Open a student for details, titles, and actions.",
      value: null as number | null,
      cta: "Open list",
    },
    {
      href: "/users/requests",
      label: "Requested titles",
      hint: "Ownership claims and proof waiting for staff confirm or reject.",
      value: pendingTitles,
      cta: pendingTitles ? "Review queue" : "Open queue",
    },
    {
      href: "/students/help-desk",
      label: "Help desk",
      hint: "Portal-to-portal chat with student teams. Reply in the messaging app. No email required.",
      value: helpDeskUnread,
      cta: helpDeskUnread ? "Open inbox" : "Open chat",
    },
    {
      href: "/students",
      label: "Student workspaces",
      hint: "Plans, progress, sessions, and payments for each portal project team.",
      value: null,
      cta: "Open workspaces",
    },
  ];

  return (
    <section id="students" className="mt-10 scroll-mt-28 space-y-4">
      <div>
        <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">Students & portal</h2>
        <p className="text-dash-muted-foreground mt-1 max-w-3xl text-sm">
          The student system now runs through Registered users (secure links), Requested titles, and Help desk chat in
          the portal. Use these shortcuts instead of digging through project checklists alone.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border-dash-border bg-dash-card hover:bg-dash-muted/40 block rounded-2xl border p-4 shadow-sm transition-colors sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{card.label}</p>
              {typeof card.value === "number" && card.value > 0 ? (
                <span className="bg-dash-accent inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                  {card.value > 99 ? "99+" : card.value}
                </span>
              ) : null}
            </div>
            <p className="text-dash-foreground mt-2 text-sm leading-relaxed">{card.hint}</p>
            <p className="text-dash-accent mt-3 text-xs font-semibold">{card.cta} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
