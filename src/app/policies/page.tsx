import Link from "next/link";

import { NexisWordmark } from "@/components/brand/nexis-wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SiteFooter } from "@/components/portal/site-footer";

export const metadata = {
  title: "Policies & Guidelines · Honic Nexis",
  description: "Project workflow rules, submission guidelines, and academic policies for Honic Nexis.",
};

const POLICIES = [
  {
    id: "project-workflow",
    title: "Project Workflow",
    description: "Guidelines for managing your project timeline and milestones",
    rules: [
      "Complete all milestones by their target dates",
      "Update milestone status regularly to reflect current progress",
      "Mark tasks as blocked if facing dependencies or issues",
      "Communicate delays to your supervisor immediately",
      "Submit deliverables through the workspace portal",
    ],
  },
  {
    id: "submission-guidelines",
    title: "Submission Guidelines",
    description: "Requirements for submitting project documentation and deliverables",
    rules: [
      "Documents must be in PDF, Word, PowerPoint, or image format",
      "File size limit: 25 MB per document",
      "Include clear naming: [ProjectName]_[Date]_[DocumentType]",
      "Ensure all files are virus-scanned before submission",
      "Maintain confidentiality of sensitive project information",
    ],
  },
  {
    id: "academic-integrity",
    title: "Academic Integrity",
    description: "Standards for original work and proper attribution",
    rules: [
      "All submitted work must be original or properly attributed",
      "Cite all sources using your institution's preferred format",
      "Plagiarism detection tools may be used to verify submissions",
      "Violations will be reported to academic authorities",
      "Co-authored work must clearly indicate each contributor",
    ],
  },
  {
    id: "data-privacy",
    title: "Data Privacy & Security",
    description: "Protecting your project data and personal information",
    rules: [
      "Personal data is encrypted and stored securely",
      "Only authorized supervisors can access your project workspace",
      "Do not share sensitive information in public spaces",
      "Report security concerns to Honic support immediately",
      "Your data is retained according to institutional policy",
    ],
  },
  {
    id: "collaboration",
    title: "Collaboration & Communication",
    description: "Best practices for team collaboration and supervisor communication",
    rules: [
      "Respond to supervisor feedback within 48 hours",
      "Use the messaging portal for all official communications",
      "Schedule meetings with appropriate notice (48+ hours)",
      "Maintain professional communication at all times",
      "Document all major decisions and discussions",
    ],
  },
  {
    id: "technical-support",
    title: "Technical Support & Troubleshooting",
    description: "Getting help when you encounter technical issues",
    rules: [
      "Report issues through the help portal first",
      "Provide detailed error messages and reproduction steps",
      "Allow 24-48 hours for support responses",
      "Check documentation and FAQs before contacting support",
      "Critical issues receive priority support",
    ],
  },
];

export default function PoliciesPage() {
  return (
    <div className="bg-dash-canvas text-dash-foreground min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-dash-border/50 bg-dash-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <NexisWordmark />
            <h1 className="text-lg font-bold">Policies & Guidelines</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* Introduction */}
          <section className="mb-10">
            <p className="text-dash-muted-foreground text-base leading-relaxed">
              These policies and guidelines help ensure a smooth, secure, and productive experience in Honic Nexis.
              Please familiarize yourself with these rules before proceeding with your project work.
            </p>
          </section>

          {/* Quick navigation */}
          <nav className="mb-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {POLICIES.map((policy) => (
              <Link
                key={policy.id}
                href={`#${policy.id}`}
                className="border border-dash-border/50 bg-dash-card/50 hover:bg-dash-card/80 rounded-lg px-4 py-3 text-sm font-medium text-dash-accent transition-colors"
              >
                {policy.title}
              </Link>
            ))}
          </nav>

          {/* Policy sections */}
          <div className="space-y-8">
            {POLICIES.map((policy) => (
              <section
                key={policy.id}
                id={policy.id}
                className="border border-dash-border/50 bg-dash-card rounded-2xl p-6 scroll-mt-20"
              >
                <div className="mb-5">
                  <h2 className="text-2xl font-bold text-dash-foreground mb-2">{policy.title}</h2>
                  <p className="text-dash-muted-foreground text-sm">{policy.description}</p>
                </div>

                <ul className="space-y-3">
                  {policy.rules.map((rule, idx) => (
                    <li key={idx} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 h-5 w-5 rounded-full bg-dash-accent/10 border border-dash-accent/30 flex items-center justify-center text-xs font-semibold text-dash-accent">
                        ✓
                      </span>
                      <span className="text-dash-foreground/90 leading-relaxed">{rule}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* Contact and support */}
          <section className="mt-10 bg-dash-accent/5 border border-dash-accent/20 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-dash-foreground mb-3">Questions or concerns?</h3>
            <p className="text-dash-muted-foreground text-sm mb-4">
              For clarification on any policy or to report a concern, contact your supervisor or reach out to Honic support through the portal.
            </p>
            <div className="flex gap-3">
              <Link
                href="/portal/jobs"
                className="text-dash-accent font-medium text-sm hover:underline"
              >
                View support tickets
              </Link>
              <span className="text-dash-muted-foreground">·</span>
              <Link
                href="/"
                className="text-dash-accent font-medium text-sm hover:underline"
              >
                Back to home
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
