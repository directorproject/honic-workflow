/**
 * Share route intro lines — shown in the sticky header (sm+) or as page titles in the body (mobile).
 */
export function ShareIntroTitles({ variant }: { variant: "header" | "content" }) {
  if (variant === "content") {
    return (
      <header className="space-y-2">
        <p className="text-dash-accent text-xs font-bold tracking-[0.2em] uppercase">Shared with you</p>
        <h1 className="text-dash-foreground text-2xl font-bold leading-tight tracking-tight">Project update</h1>
        <p className="text-dash-muted-foreground text-sm leading-relaxed">Read-only link: preview and download files below.</p>
      </header>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-dash-accent text-[11px] font-bold tracking-[0.2em] uppercase sm:text-xs">Shared with you</p>
      <p className="text-dash-foreground text-sm font-semibold sm:text-base">Project update</p>
      <p className="text-dash-muted-foreground text-xs leading-relaxed sm:text-[13px]">
        Read-only link: preview and download files below.
      </p>
    </div>
  );
}
