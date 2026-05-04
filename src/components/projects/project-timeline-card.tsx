import { ProjectTimelineFields } from "@/components/projects/project-timeline-fields";

/**
 * Server component: static copy is identical on server and in the first HTML paint,
 * avoiding hydration mismatches with the interactive fields below.
 */
export function ProjectTimelineCard() {
  return (
    <section
      className="border-dash-border bg-dash-card h-full rounded-2xl border p-5 shadow-sm"
      aria-labelledby="timeline-heading"
    >
      <h3 id="timeline-heading" className="text-dash-foreground mb-1 text-sm font-semibold">
        Project timeline
      </h3>
      <p className="text-dash-muted-foreground mb-4 text-xs leading-relaxed">
        A <span className="text-dash-foreground font-medium">milestone</span> is a planned checkpoint on the calendar
        (for example schematic review, prototype build)—different from the Pipeline checklist, which tracks design
        workflow steps. Optional start/end dates define the project window; for each milestone you can record who is
        assigned to that activity. Activities are chosen from the same pipeline step list as the checklist. Milestones
        show on the home Activity table and on the project Manage page.
      </p>
      <ProjectTimelineFields />
    </section>
  );
}
