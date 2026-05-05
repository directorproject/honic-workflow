function formatTimelineDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Read-only schedule card for project view and public share pages (not the editable manage form).
 */
export function ProjectReadOnlyTimelineCard({
  startDate,
  targetEndDate,
}: {
  startDate: string | null;
  targetEndDate: string | null;
}) {
  const start = formatTimelineDate(startDate);
  const end = formatTimelineDate(targetEndDate);
  if (!start && !end) return null;

  return (
    <section
      className="border-dash-border bg-dash-card/60 mb-6 max-w-lg rounded-2xl border p-4 sm:p-5"
      aria-labelledby="readonly-timeline-heading"
    >
      <h3 id="readonly-timeline-heading" className="text-dash-foreground mb-3 text-center text-sm font-semibold tracking-tight">
        Timeline
      </h3>
      <dl className={`grid gap-4 ${start && end ? "grid-cols-2" : "grid-cols-1"} sm:grid-cols-2 sm:gap-6`}>
        {start ? (
          <div className={start && end ? "text-left" : ""}>
            <dt className="text-dash-muted-foreground text-xs font-medium">Project Start</dt>
            <dd className="text-dash-foreground mt-1 text-sm font-semibold sm:text-base">{start}</dd>
          </div>
        ) : null}
        {end ? (
          <div className={start && end ? "text-left" : ""}>
            <dt className="text-dash-muted-foreground text-xs font-medium">Project Target end</dt>
            <dd className="text-dash-foreground mt-1 text-sm font-semibold sm:text-base">{end}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
