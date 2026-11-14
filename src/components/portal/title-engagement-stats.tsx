import type { TitleEngagement } from "@/lib/portal/title-engagement";

export function TitleEngagementStats({
  stats,
  compact = false,
}: {
  stats: TitleEngagement | null | undefined;
  compact?: boolean;
}) {
  const clicks = stats?.clickCount ?? 0;
  const buys = stats?.buyCount ?? 0;

  if (compact) {
    return (
      <p className="text-dash-muted-foreground mt-2 text-xs">
        <span className="text-dash-foreground font-semibold tabular-nums">{clicks}</span> title click
        {clicks === 1 ? "" : "s"}
        <span className="mx-1.5 opacity-40">·</span>
        <span className="text-dash-foreground font-semibold tabular-nums">{buys}</span> document buy
        {buys === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <div className="border-dash-border mt-4 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2">
      <div className="bg-dash-card/50 px-4 py-3">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Title clicks</p>
        <p className="text-dash-foreground mt-1 text-2xl font-semibold tabular-nums">{clicks}</p>
        <p className="text-dash-muted-foreground mt-1 text-xs">People who opened this title</p>
      </div>
      <div className="bg-dash-card/50 px-4 py-3">
        <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Document buys</p>
        <p className="text-dash-foreground mt-1 text-2xl font-semibold tabular-nums">{buys}</p>
        <p className="text-dash-muted-foreground mt-1 text-xs">People who opened your published files</p>
      </div>
    </div>
  );
}
