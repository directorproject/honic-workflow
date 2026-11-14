import { addDays, diffDays } from "@/lib/workspace/dates";

type TemplateTask = { title: string; weight: number; milestone?: boolean };
type TemplatePhase = { name: string; color: string; tasks: TemplateTask[] };

/** Ready-made plans. Weights are shares of the project duration; tasks run one after another. */
export const PLAN_TEMPLATES: Record<string, { label: string; phases: TemplatePhase[] }> = {
  fyp: {
    label: "Final Year Project",
    phases: [
      {
        name: "Proposal",
        color: "sky",
        tasks: [
          { title: "Refine the title and scope with the supervisor", weight: 3 },
          { title: "Write problem statement and objectives", weight: 4 },
          { title: "Write the project proposal", weight: 6 },
          { title: "Proposal presentation", weight: 1, milestone: true },
        ],
      },
      {
        name: "Literature review",
        color: "violet",
        tasks: [
          { title: "Review related projects and papers", weight: 7 },
          { title: "Write chapter 2: literature review", weight: 5 },
        ],
      },
      {
        name: "Design",
        color: "amber",
        tasks: [
          { title: "System block diagram and requirements", weight: 4 },
          { title: "Circuit and software design", weight: 7 },
          { title: "Simulation", weight: 5 },
          { title: "Design review with supervisor", weight: 1, milestone: true },
        ],
      },
      {
        name: "Parts and procurement",
        color: "orange",
        tasks: [
          { title: "Final parts list and budget", weight: 2 },
          { title: "Buy components", weight: 4 },
        ],
      },
      {
        name: "Implementation",
        color: "emerald",
        tasks: [
          { title: "Build the hardware", weight: 10 },
          { title: "Write the firmware and software", weight: 10 },
          { title: "Integrate hardware and software", weight: 5 },
          { title: "Progress presentation", weight: 1, milestone: true },
        ],
      },
      {
        name: "Testing",
        color: "cyan",
        tasks: [
          { title: "Test each part", weight: 4 },
          { title: "Full system tests and data collection", weight: 6 },
          { title: "Analyse results", weight: 3 },
        ],
      },
      {
        name: "Report and defence",
        color: "rose",
        tasks: [
          { title: "Write chapters 3 to 5", weight: 8 },
          { title: "Supervisor review of the final report", weight: 3 },
          { title: "Submit final report", weight: 1, milestone: true },
          { title: "Prepare presentation and demo", weight: 3 },
          { title: "Final defence", weight: 1, milestone: true },
        ],
      },
    ],
  },
  research: {
    label: "Research project",
    phases: [
      {
        name: "Proposal",
        color: "sky",
        tasks: [
          { title: "Define research problem and questions", weight: 4 },
          { title: "Write the research proposal", weight: 7 },
          { title: "Proposal approval", weight: 1, milestone: true },
        ],
      },
      {
        name: "Literature review",
        color: "violet",
        tasks: [
          { title: "Search and read sources", weight: 8 },
          { title: "Write literature review chapter", weight: 6 },
        ],
      },
      {
        name: "Methodology",
        color: "amber",
        tasks: [
          { title: "Design methods, sample and tools", weight: 6 },
          { title: "Get research permit or ethics approval", weight: 4, milestone: false },
          { title: "Pilot test the tools", weight: 3 },
        ],
      },
      {
        name: "Data collection",
        color: "emerald",
        tasks: [
          { title: "Collect data", weight: 14 },
          { title: "Clean and organise data", weight: 4 },
        ],
      },
      {
        name: "Analysis",
        color: "cyan",
        tasks: [
          { title: "Analyse data", weight: 8 },
          { title: "Interpret findings", weight: 4 },
        ],
      },
      {
        name: "Report and defence",
        color: "rose",
        tasks: [
          { title: "Write results and discussion", weight: 8 },
          { title: "Conclusion and recommendations", weight: 3 },
          { title: "Submit final report", weight: 1, milestone: true },
          { title: "Prepare presentation", weight: 3 },
          { title: "Final defence", weight: 1, milestone: true },
        ],
      },
    ],
  },
  innovation: {
    label: "Innovation project",
    phases: [
      {
        name: "Discover",
        color: "sky",
        tasks: [
          { title: "Talk to users and define the problem", weight: 6 },
          { title: "Study existing solutions and the market", weight: 4 },
          { title: "Concept note", weight: 1, milestone: true },
        ],
      },
      {
        name: "Ideate and design",
        color: "violet",
        tasks: [
          { title: "Generate and choose ideas", weight: 4 },
          { title: "Design the solution", weight: 6 },
        ],
      },
      {
        name: "Prototype 1",
        color: "amber",
        tasks: [
          { title: "Get parts and tools", weight: 3 },
          { title: "Build the first prototype", weight: 10 },
          { title: "Test with users", weight: 5 },
        ],
      },
      {
        name: "Prototype 2",
        color: "emerald",
        tasks: [
          { title: "Improve from feedback", weight: 8 },
          { title: "Field test", weight: 5 },
        ],
      },
      {
        name: "Business and protection",
        color: "orange",
        tasks: [
          { title: "Business model and costing", weight: 4 },
          { title: "Check intellectual property and registration", weight: 3 },
        ],
      },
      {
        name: "Pitch and report",
        color: "rose",
        tasks: [
          { title: "Write the innovation report", weight: 6 },
          { title: "Prepare pitch deck and demo", weight: 4 },
          { title: "Pitch or exhibition", weight: 1, milestone: true },
        ],
      },
    ],
  },
};

/** One full document by default. Partials are split from pages later, not pre-made chapter rows. */
export const DEFAULT_DOCUMENTS: Record<string, string[]> = {
  fyp: ["Report"],
  research: ["Report"],
  innovation: ["Report"],
};

/** Old seeded chapter rows we remove when empty (no file uploaded). */
export const LEGACY_SECTION_DOC_NAMES = new Set([
  "Project proposal",
  "Chapter 1: Introduction",
  "Chapter 2: Literature review",
  "Chapter 3: Methodology and design",
  "Chapter 3: Methodology",
  "Chapter 4: Results and discussion",
  "Chapter 4: Findings and discussion",
  "Chapter 5: Conclusion and recommendations",
  "Chapter 5: Conclusion",
  "Final report",
  "Presentation slides",
  "Research proposal",
  "Research permit or ethics approval",
  "Data collection tools",
  "Concept note",
  "Design document",
  "Test report",
  "Business model",
  "Innovation report",
  "Pitch deck",
]);

export function isLegacyEmptySectionName(name: string): boolean {
  const n = name.trim();
  if (LEGACY_SECTION_DOC_NAMES.has(n)) return true;
  return /^chapter\s+\d+/i.test(n);
}

export const DEFAULT_DEFENCE_CHECKS = [
  "Slides ready (problem, objectives, method, results, conclusion)",
  "Demo works from power-on, with a backup video",
  "Practice the talk within the time limit",
  "Print copies of the report",
  "Bring the prototype, chargers and spare parts",
  "Know every number in the results",
  "Supervisor has seen the final slides",
];

export const DEFAULT_DEFENCE_QUESTIONS = [
  "What problem does your project solve, and for whom?",
  "Why did you choose this design or method over others?",
  "What are the limitations of your work?",
  "How did you test it, and how do you know the results are correct?",
  "How much does it cost, and could it be produced locally?",
  "What would you improve with more time or money?",
  "What is new in your project compared to existing solutions?",
];

export type PlannedTask = {
  phaseIndex: number;
  title: string;
  start_date: string;
  due_date: string;
  is_milestone: boolean;
  dependsOnIndex: number | null;
};

/** Spreads the template between start and end; each task depends on the one before it. */
export function buildPlan(category: string, start: string, end: string) {
  const template = PLAN_TEMPLATES[category] ?? PLAN_TEMPLATES.fyp;
  const totalDays = Math.max(14, diffDays(end, start));
  const all = template.phases.flatMap((p, phaseIndex) => p.tasks.map((t) => ({ ...t, phaseIndex })));
  const totalWeight = all.reduce((s, t) => s + t.weight, 0);

  let cursor = 0;
  const tasks: PlannedTask[] = all.map((t, i) => {
    const span = t.milestone ? 0 : Math.max(1, Math.round((t.weight / totalWeight) * totalDays) - 1);
    const s = Math.min(cursor, totalDays);
    const e = Math.min(s + span, totalDays);
    cursor = e + 1;
    return {
      phaseIndex: t.phaseIndex,
      title: t.title,
      start_date: addDays(start, s),
      due_date: addDays(start, e),
      is_milestone: Boolean(t.milestone),
      dependsOnIndex: i > 0 ? i - 1 : null,
    };
  });
  return { phases: template.phases.map((p) => ({ name: p.name, color: p.color })), tasks };
}
