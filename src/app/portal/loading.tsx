export default function PortalLoading() {
  return (
    <div className="bg-dash-canvas text-dash-foreground flex min-h-screen flex-col">
      <div className="border-dash-border bg-dash-card/80 sticky top-0 z-30 h-[3.6rem] border-b sm:h-[4.25rem]" />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="bg-dash-muted/40 h-8 w-40 animate-pulse rounded-md" />
        <div className="bg-dash-muted/30 mt-3 h-4 w-72 max-w-full animate-pulse rounded-md" />
        <div className="mt-8 space-y-3">
          <div className="bg-dash-muted/25 h-24 animate-pulse rounded-lg" />
          <div className="bg-dash-muted/20 h-24 animate-pulse rounded-lg" />
          <div className="bg-dash-muted/15 h-24 animate-pulse rounded-lg" />
        </div>
      </div>
    </div>
  );
}
