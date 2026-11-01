"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { linkStudentAccountAction, unlinkStudentAccountAction } from "@/app/projects/[id]/student-account-actions";

export type LinkedStudent = { fullName: string; regNo: string | null; study: string | null; email: string | null };

export function StudentAccountCard({ projectId, student }: { projectId: string; student: LinkedStudent | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>, okMessage: string) {
    setStatus(null);
    startTransition(async () => {
      try {
        await action();
        setStatus({ ok: true, message: okMessage });
        router.refresh();
      } catch (err) {
        setStatus({ ok: false, message: err instanceof Error ? err.message : "Action failed." });
      }
    });
  }

  return (
    <section className="border-dash-border bg-dash-card mb-8 rounded-2xl border p-5 shadow-sm">
      <h2 className="text-dash-foreground text-base font-semibold">Student portal account</h2>
      <p className="text-dash-muted-foreground mt-1 text-sm">
        A linked student follows this project in their portal on share.honiccompany.com and gets an email when progress
        changes.
      </p>
      {student ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-dash-foreground font-semibold">{student.fullName}</span>
          <span className="text-dash-muted-foreground">{[student.study, student.regNo, student.email].filter(Boolean).join(" · ")}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Unlink ${student.fullName} from this project?`)) return;
              run(() => unlinkStudentAccountAction(projectId), "Student unlinked.");
            }}
            className="ml-auto rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
          >
            Unlink
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const email = String(new FormData(e.currentTarget).get("email") ?? "");
            run(() => linkStudentAccountAction(projectId, email), "Student linked. They can now see this project in their portal.");
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            name="email"
            type="email"
            required
            placeholder="Student's portal email"
            className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
          />
          <button type="submit" disabled={pending} className="bg-dash-accent rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "Linking…" : "Link account"}
          </button>
        </form>
      )}
      {status ? (
        <p className={`mt-2 text-sm ${status.ok ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
