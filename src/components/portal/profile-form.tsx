"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalSaveProfileAction, type PortalResult } from "@/app/portal/actions";
import { Card, Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
import { DEFAULT_INSTITUTION, YEARS_OF_STUDY } from "@/lib/portal/config";
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

  return (
    <Card
      title={profile ? "Edit your details" : "Your details"}
      subtitle="We show you only the titles for your course."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const get = (k: string) => String(fd.get(k) ?? "");
          setStatus(null);
          startTransition(async () => {
            const res = await portalSaveProfileAction({
              fullName: get("fullName"),
              regNo: get("regNo"),
              phone: get("phone"),
              institution: get("institution"),
              courseCode: get("courseCode"),
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
        <Field label="Full name *" wide>
          <input name="fullName" required maxLength={120} className={INPUT} defaultValue={profile?.fullName ?? suggestedName ?? ""} />
        </Field>
        <Field label="Registration number *">
          <input name="regNo" required maxLength={40} className={INPUT} defaultValue={profile?.regNo} />
        </Field>
        <Field label="Phone (mobile money) *">
          <input name="phone" required maxLength={30} placeholder="07XX XXX XXX" className={INPUT} defaultValue={profile?.phone} />
        </Field>
        <Field label="Institution *">
          <input name="institution" required maxLength={160} className={INPUT} defaultValue={profile?.institution ?? DEFAULT_INSTITUTION} />
        </Field>
        <Field label="Course *">
          <select name="courseCode" required className={INPUT} defaultValue={profile?.courseCode ?? courses[0]?.code}>
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </Field>
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
          <input name="partner" maxLength={160} placeholder="Name and registration number" className={INPUT} defaultValue={profile?.partner ?? ""} />
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
