"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCourseAction } from "@/app/titles/actions";

const INPUT =
  "border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2";

export function AddCourseForm({ courses }: { courses: { code: string; name: string }[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-dash-border bg-dash-card rounded-2xl border p-4 shadow-sm">
      <p className="text-dash-foreground text-sm font-semibold">Courses on the student portal</p>
      <p className="text-dash-muted-foreground mt-1 text-xs">
        {courses.map((c) => `${c.code} (${c.name})`).join(" · ") || "None yet."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          setStatus(null);
          startTransition(async () => {
            try {
              await createCourseAction(String(fd.get("code") ?? ""), String(fd.get("name") ?? ""));
              form.reset();
              setStatus({ ok: true, message: "Course added." });
              router.refresh();
            } catch (err) {
              setStatus({ ok: false, message: err instanceof Error ? err.message : "Could not add course." });
            }
          });
        }}
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <input name="code" required maxLength={12} placeholder="Code, e.g. EE" className={`${INPUT} w-28 uppercase`} />
        <input name="name" required maxLength={160} placeholder="Course name" className={`${INPUT} min-w-0 flex-1`} />
        <button type="submit" disabled={pending} className="bg-dash-accent rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Adding…" : "Add course"}
        </button>
      </form>
      {status ? (
        <p className={`mt-2 text-xs ${status.ok ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
