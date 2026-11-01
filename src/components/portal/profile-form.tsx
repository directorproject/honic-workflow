"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalSaveProfileAction, type PortalResult } from "@/app/portal/actions";
import { Card, Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { SearchSelect } from "@/components/portal/search-select";
import {
  DEFAULT_INSTITUTION,
  INSTITUTIONS,
  OTHER_COURSE_CODE,
  OTHER_OPTION,
  YEARS_OF_STUDY,
} from "@/lib/portal/config";
import type { Course, StudentProfile } from "@/lib/portal/data";

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

  const listedCourses = courses.filter((c) => c.code !== OTHER_COURSE_CODE);

  return (
    <Card title={profile ? "Edit your details" : "Your details"} subtitle="Your course and institution help us put the best titles for you first.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const get = (k: string) => String(fd.get(k) ?? "");
          setStatus(null);
          startTransition(async () => {
            const res = await portalSaveProfileAction({
              fullName: get("fullName"),
              phone: get("phone"),
              institution: institutionChoice === OTHER_OPTION ? get("institutionOther") : institutionChoice,
              courseCode: courseChoice,
              courseOther: courseChoice === OTHER_COURSE_CODE ? get("courseOther") : "",
              yearOfStudy: get("yearOfStudy"),
              academicYear: get("academicYear"),
              partner: get("partner"),
            });
            setStatus(res);
            if (res.ok) router.push("/portal");
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

        <Field label="Year of study *">
          <select name="yearOfStudy" required className={INPUT} defaultValue={profile?.yearOfStudy ?? YEARS_OF_STUDY[3]}>
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
          <button type="submit" disabled={pending} className={PRIMARY}>
            {pending ? "Saving…" : profile ? "Save details" : "Save and see titles"}
          </button>
          <StatusText status={status} />
        </div>
      </form>
    </Card>
  );
}
