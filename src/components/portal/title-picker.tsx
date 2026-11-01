"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { portalSelectTitleAction, type PortalResult } from "@/app/portal/actions";
import { Card, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { TITLE_CHANGE_FEE_TSH } from "@/lib/portal/config";
import type { Course, PortalTitle } from "@/lib/portal/data";

const ALL = "__all__";
const ANY_INSTITUTION = "__any__";

export function TitlePicker({
  titles,
  courses,
  hasCredit,
}: {
  titles: PortalTitle[];
  courses: Course[];
  hasCredit: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<PortalTitle | null>(null);
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [courseFilter, setCourseFilter] = useState(ALL);
  const [institutionFilter, setInstitutionFilter] = useState(ALL);

  const courseName = useMemo(() => new Map(courses.map((c) => [c.code, c.name])), [courses]);
  const courseOptions = useMemo(
    () => [...new Set(titles.map((t) => t.courseCode).filter((c): c is string => Boolean(c)))].sort(),
    [titles],
  );
  const institutionOptions = useMemo(
    () => [...new Set(titles.map((t) => t.institution).filter((i): i is string => Boolean(i)))].sort(),
    [titles],
  );

  const visible = titles.filter(
    (t) =>
      (courseFilter === ALL || t.courseCode === courseFilter) &&
      (institutionFilter === ALL ||
        (institutionFilter === ANY_INSTITUTION ? !t.institution : t.institution === institutionFilter)),
  );
  const filtered = courseFilter !== ALL || institutionFilter !== ALL;
  const recommendedCount = titles.filter((t) => t.recommended).length;

  return (
    <Card
      title="Choose your project title"
      subtitle={`${titles.length} titles available. You can choose a title from any course; the best matches for your course and institution are shown first.`}
    >
      {hasCredit ? (
        <p className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
          Payment received. Choose your new title.
        </p>
      ) : null}

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <label>
          <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Filter by course</span>
          <select className={INPUT} value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value={ALL}>All courses</option>
            {courseOptions.map((code) => (
              <option key={code} value={code}>
                {courseName.get(code) ?? code} ({code})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Filter by institution</span>
          <select className={INPUT} value={institutionFilter} onChange={(e) => setInstitutionFilter(e.target.value)}>
            <option value={ALL}>All institutions</option>
            <option value={ANY_INSTITUTION}>Open to any institution</option>
            {institutionOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <StatusText status={status} />
      {!filtered && recommendedCount > 0 ? (
        <p className="text-dash-foreground mt-1 mb-2 text-sm font-semibold">Recommended for you</p>
      ) : null}

      <ul className="space-y-3">
        {visible.map((t, i) => {
          const firstOther = !filtered && !t.recommended && (i === 0 || visible[i - 1]?.recommended);
          return (
            <li key={t.id}>
              {firstOther && recommendedCount > 0 ? (
                <p className="text-dash-foreground mt-5 mb-2 text-sm font-semibold">More titles</p>
              ) : null}
              <div className={`rounded-xl border p-4 ${t.recommended ? "border-dash-accent/40 bg-dash-accent/5" : "border-dash-border"}`}>
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {t.courseCode ? (
                    <span className="bg-dash-accent/10 text-dash-accent inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold">
                      {t.courseCode}
                    </span>
                  ) : null}
                  {t.institution ? (
                    <span className="border-dash-border text-dash-muted-foreground inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                      {t.institution}
                    </span>
                  ) : null}
                </div>
                <p className="text-dash-foreground font-semibold leading-snug">{t.title}</p>
                {t.summary ? <p className="text-dash-muted-foreground mt-1 text-sm">{t.summary}</p> : null}
                {t.hardware || t.communication ? (
                  <details className="mt-2 text-sm">
                    <summary className="text-dash-accent cursor-pointer text-xs font-semibold">More details</summary>
                    {t.hardware ? (
                      <p className="text-dash-foreground mt-2">
                        <span className="text-dash-muted-foreground text-xs font-semibold uppercase">Hardware: </span>
                        {t.hardware}
                      </p>
                    ) : null}
                    {t.communication ? (
                      <p className="text-dash-foreground mt-1">
                        <span className="text-dash-muted-foreground text-xs font-semibold uppercase">Communication: </span>
                        {t.communication}
                      </p>
                    ) : null}
                  </details>
                ) : null}
                <button type="button" onClick={() => setConfirm(t)} className={`${PRIMARY} mt-3 px-3 py-1.5 text-xs`}>
                  Select this title
                </button>
              </div>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="text-dash-muted-foreground py-6 text-center text-sm">
            {filtered ? "No titles match these filters." : "No titles are open right now. Please check again later."}
          </li>
        ) : null}
      </ul>

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="bg-dash-card border-dash-border w-full max-w-md rounded-2xl border p-5 shadow-xl">
            <p className="text-dash-foreground font-semibold">Select this title?</p>
            <p className="text-dash-foreground mt-2 text-sm">{confirm.title}</p>
            <p className="text-dash-muted-foreground mt-3 text-sm">
              It will be hidden from other students. Changing later costs TSh {TITLE_CHANGE_FEE_TSH.toLocaleString()}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setConfirm(null)} className={SECONDARY}>
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                className={PRIMARY}
                onClick={() =>
                  startTransition(async () => {
                    const res = await portalSelectTitleAction(confirm.id);
                    setStatus(res.ok ? null : res);
                    setConfirm(null);
                    router.refresh();
                  })
                }
              >
                {pending ? "Selecting…" : "Yes, select it"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
