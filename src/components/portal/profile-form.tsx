"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalSaveProfileAction, type PortalResult } from "@/app/portal/actions";
import { Card, Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { SearchSelect } from "@/components/portal/search-select";
import { Spinner } from "@/components/ui/spinner";
import {
  DEFAULT_INSTITUTION,
  INSTITUTIONS,
  OTHER_COURSE_CODE,
  OTHER_OPTION,
  PROJECT_CATEGORIES,
  STUDY_LEVELS,
  YEARS_OF_STUDY,
} from "@/lib/portal/config";
import type { Course, StudentProfile } from "@/lib/portal/data";

function ChoiceChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="sm:col-span-2" role="radiogroup" aria-label={label}>
      <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-dash-accent bg-dash-accent/15 text-dash-foreground ring-dash-accent/30 ring-2"
                  : "border-dash-border bg-dash-muted/30 text-dash-muted-foreground hover:border-dash-accent/50 hover:text-dash-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProfileForm({
  courses,
  profile,
  cancelHref,
  suggestedName,
}: {
  courses: Course[];
  profile: StudentProfile | null;
  cancelHref?: string;
  suggestedName?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [pending, startTransition] = useTransition();

  const savedInstitution = profile?.institution ?? DEFAULT_INSTITUTION;
  const institutionListed = (INSTITUTIONS as readonly string[]).includes(savedInstitution);
  const [institutionChoice, setInstitutionChoice] = useState(institutionListed ? savedInstitution : OTHER_OPTION);
  const [courseChoice, setCourseChoice] = useState(profile?.courseCode ?? courses[0]?.code ?? "");
  const [studyLevel, setStudyLevel] = useState(profile?.studyLevel ?? "");
  const [projectCategory, setProjectCategory] = useState(profile?.projectCategory ?? "");

  const listedCourses = courses.filter((c) => c.code !== OTHER_COURSE_CODE);

  return (
    <Card title={profile ? "Edit your details" : "Your details"} subtitle="Your course and institution help us put the best titles for you first.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const get = (k: string) => String(fd.get(k) ?? "");
          if (!studyLevel) return setStatus({ ok: false, message: "Choose your level of study." });
          if (!projectCategory) return setStatus({ ok: false, message: "Choose your project type." });
          setStatus(null);
          startTransition(async () => {
            const res = await portalSaveProfileAction({
              fullName: get("fullName"),
              phone: get("phone"),
              institution: institutionChoice === OTHER_OPTION ? get("institutionOther") : institutionChoice,
              courseCode: courseChoice,
              courseOther: courseChoice === OTHER_COURSE_CODE ? get("courseOther") : "",
              studyLevel,
              studyLevelOther: studyLevel === "other" ? get("studyLevelOther") : "",
              projectCategory,
              yearOfStudy: get("yearOfStudy"),
              academicYear: get("academicYear"),
              partner: get("partner"),
            });
            setStatus(res);
            if (res.ok) router.push(profile ? "/portal" : "/portal/titles");
          });
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Field label="Full name *">
          <input name="fullName" required maxLength={120} className={INPUT} defaultValue={profile?.fullName ?? suggestedName ?? ""} />
        </Field>
        <Field label="Phone (mobile money) *">
          <input name="phone" required maxLength={30} placeholder="07XX XXX XXX" className={INPUT} defaultValue={profile?.phone} />
        </Field>

        <Field label="Institution *" wide>
          <SearchSelect
            value={institutionChoice}
            onChange={setInstitutionChoice}
            searchPlaceholder="Search institution, e.g. UDSM or Mbeya"
            emptyText="Not in the list? Choose Other (type it)."
            options={[
              ...INSTITUTIONS.map((name) => ({ value: name, label: name })),
              { value: OTHER_OPTION, label: "Other (type it)" },
            ]}
          />
        </Field>
        {institutionChoice === OTHER_OPTION ? (
          <Field label="Your institution *" wide>
            <input
              name="institutionOther"
              required
              maxLength={160}
              placeholder="Full name of your university or college"
              className={INPUT}
              defaultValue={institutionListed ? "" : savedInstitution}
            />
          </Field>
        ) : null}

        <Field label="Course *" wide>
          <SearchSelect
            value={courseChoice}
            onChange={setCourseChoice}
            searchPlaceholder="Search course, e.g. Electrical or ETE"
            emptyText="Not in the list? Choose Other (type it)."
            options={[
              ...listedCourses.map((c) => ({ value: c.code, label: c.name, hint: c.code })),
              { value: OTHER_COURSE_CODE, label: "Other (type it)" },
            ]}
          />
        </Field>
        {courseChoice === OTHER_COURSE_CODE ? (
          <Field label="Your course *" wide>
            <input
              name="courseOther"
              required
              maxLength={120}
              placeholder="Full name of your course"
              className={INPUT}
              defaultValue={profile?.courseOther ?? ""}
            />
          </Field>
        ) : null}

        <ChoiceChips label="Level of study *" options={STUDY_LEVELS} value={studyLevel} onChange={setStudyLevel} />
        {studyLevel === "other" ? (
          <Field label="Your level of study *" wide>
            <input
              name="studyLevelOther"
              required
              maxLength={80}
              placeholder="e.g. Certificate, Higher Diploma, PhD"
              className={INPUT}
              defaultValue={profile?.studyLevelOther ?? ""}
            />
          </Field>
        ) : null}

        <ChoiceChips
          label="Project type *"
          options={PROJECT_CATEGORIES}
          value={projectCategory}
          onChange={setProjectCategory}
        />

        <Field label="Year of study (optional)">
          <select name="yearOfStudy" className={INPUT} defaultValue={profile?.yearOfStudy ?? ""}>
            <option value="">Not specified</option>
            {YEARS_OF_STUDY.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </Field>
        <Field label="Academic year *">
          <input name="academicYear" required maxLength={20} placeholder="2026/2027" className={INPUT} defaultValue={profile?.academicYear ?? "2026/2027"} />
        </Field>
        <Field label="Group partner (optional)" wide>
          <input name="partner" maxLength={160} placeholder="Partner's name" className={INPUT} defaultValue={profile?.partner ?? ""} />
        </Field>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          {cancelHref ? (
            <a href={cancelHref} className={SECONDARY}>
              Cancel
            </a>
          ) : null}
          <button type="submit" disabled={pending} aria-busy={pending} className={PRIMARY}>
            {pending ? <Spinner /> : null}
            {pending ? "Saving…" : profile ? "Save details" : "Save and see titles"}
          </button>
          <StatusText status={status} />
        </div>
      </form>
    </Card>
  );
}
