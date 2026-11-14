import Link from "next/link";

type Props = {
  title: string;
  body?: string;
  className?: string;
};

/** Upgrade wall for features that need an active Nexis Desk plan. */
export function PaidPlanGate({
  title,
  body = "Free plan can browse. This feature unlocks with a semester or full-year Nexis Desk plan.",
  className = "",
}: Props) {
  return (
    <div className={`border-dash-border bg-dash-card rounded-md border px-4 py-6 sm:px-6 ${className}`}>
      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-[0.18em] uppercase">Nexis Desk</p>
      <h2 className="text-dash-foreground mt-1 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-dash-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">{body}</p>
      <Link
        href="/portal/packs"
        className="bg-dash-accent mt-4 inline-flex items-center justify-center rounded-sm px-4 py-2.5 text-sm font-semibold text-white"
      >
        View plans
      </Link>
    </div>
  );
}
