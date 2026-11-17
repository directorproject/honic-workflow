"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  portalSaveProfileAction,
  portalSkipProfileAction,
  type PortalResult,
} from "@/app/portal/actions";
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
} from "@/lib/portal/config";
import type { Course, StudentProfile } from "@/lib/portal/data";

function ChoiceChips({
  label,
  options,
  value,
  onChange,
  optional,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <div className="sm:col-span-2" role="radiogroup" aria-label={label}>
      <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">
        {label}
        {optional ? " (optional)" : ""}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(value === o.value ? "" : o.value)}
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

function essentialsFromForm(fd: FormData) {
  const get = (k: string) => String(fd.get(k) ?? "");
  return {
    fullName: get("fullName"),
    phone: get("phone"),
    password: get("password"),
    password2: get("password2"),
  };
}

export function ProfileForm({
  courses,
  profile,
  cancelHref,
  suggestedName,
  needsPasswordSetup = false,
}: {
  courses: Course[];
  profile: StudentProfile | null;
  cancelHref?: string;
  suggestedName?: string | null;
  /** Google and other OAuth sign-ins must set a password here; email sign-up already has one. */
  needsPasswordSetup?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [pending, startTransition] = useTransition();

  const savedInstitution = profile?.institution ?? DEFAULT_INSTITUTION;
  const institutionListed = (INSTITUTIONS as readonly string[]).includes(savedInstitution);
  const [institutionChoice, setInstitutionChoice] = useState(institutionListed ? savedInstitution : OTHER_OPTION);
  const [courseChoice, setCourseChoice] = useState(profile?.courseCode ?? courses[0]?.code ?? "");
  const [studyLevel, setStudyLevel] = useState(profile?.studyLevel ?? "");
  const [projectCategory, setProjectCategory] = useState(profile?.projectCategory ?? "");

  const listedCourses = courses.filter((c) => c.code !== OTHER_COURSE_CODE);
  const afterSavePath = profile ? "/portal/home?tab=account" : "/portal/titles";
  const onboarding = !profile;
  const showPasswordFields = onboarding && needsPasswordSetup;

  function goNext() {
    router.push(afterSavePath);
    router.refresh();
  }

  return (
    <Card
      title={profile ? "Edit your details" : "Your details"}
      subtitle={
        onboarding
          ? "Name, phone, and password (if you used Google) are required. You can skip course and institution for now."
          : "Update your account and course details any time."
      }
    >
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const get = (k: string) => String(fd.get(k) ?? "");
          setStatus(null);
          startTransition(async () => {
            const res = await portalSaveProfileAction({
              ...essentialsFromForm(fd),
              institution: institutionChoice === OTHER_OPTION ? get("institutionOther") : institutionChoice,
              courseCode: courseChoice,
              courseOther: courseChoice === OTHER_COURSE_CODE ? get("courseOther") : "",
              studyLevel,
              studyLevelOther: studyLevel === "other" ? get("studyLevelOther") : "",
              projectCategory,
              academicYear: get("academicYear"),
            });
            setStatus(res);
            if (res.ok) goNext();
          });
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <p className="text-dash-foreground sm:col-span-2 text-sm font-semibold">Account</p>

        <Field label="Full name *">
          <input name="fullName" required maxLength={120} className={INPUT} defaultValue={profile?.fullName ?? suggestedName ?? ""} />
        </Field>
        <Field label={onboarding ? "Phone (mobile money) *" : "Phone (mobile money, optional)"}>
          <input
            name="phone"
            maxLength={30}
            required={onboarding}
            placeholder="07XX XXX XXX"
            className={INPUT}
            defaultValue={profile?.phone ?? ""}
          />
        </Field>

        {showPasswordFields ? (
          <>
            <Field label="Password *">
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={INPUT}
              />
            </Field>
            <Field label="Confirm password *">
              <input
                name="password2"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={INPUT}
              />
            </Field>
          </>
        ) : null}

        <div className="border-dash-border sm:col-span-2 mt-2 border-t pt-4">
          <p className="text-dash-foreground text-sm font-semibold">Course & institution</p>
          <p className="text-dash-muted-foreground mt-1 text-xs">Optional now — you can fill these in later under My account.</p>
        </div>

        <Field label="Institution" wide>
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
          <Field label="Your institution" wide>
            <input
              name="institutionOther"
              maxLength={160}
              placeholder="Full name of your university or college"
              className={INPUT}
              defaultValue={institutionListed ? "" : savedInstitution}
            />
          </Field>
        ) : null}

        <Field label="Course" wide>
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

        <ChoiceChips label="Level of study" options={STUDY_LEVELS} value={studyLevel} onChange={setStudyLevel} optional />
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
          label="Project type"
          options={PROJECT_CATEGORIES}
          value={projectCategory}
          onChange={setProjectCategory}
          optional
        />

        <Field label="Academic year (optional)" wide>
          <input name="academicYear" maxLength={20} placeholder="2026/2027" className={INPUT} defaultValue={profile?.academicYear ?? "2026/2027"} />
        </Field>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          {onboarding ? (
            <button
              type="button"
              disabled={pending}
              className={SECONDARY}
              onClick={() => {
                const form = formRef.current;
                if (!form) return;
                setStatus(null);
                startTransition(async () => {
                  const res = await portalSkipProfileAction(essentialsFromForm(new FormData(form)));
                  setStatus(res);
                  if (res.ok) goNext();
                });
              }}
            >
              {pending ? <Spinner /> : null}
              Skip optional details
            </button>
          ) : null}
          {cancelHref ? (
            <a href={cancelHref} className={SECONDARY}>
              Cancel
            </a>
          ) : null}
          <button type="submit" disabled={pending} aria-busy={pending} className={PRIMARY}>
            {pending ? <Spinner /> : null}
            {pending ? "Saving…" : profile ? "Save details" : "Save and continue"}
          </button>
          <StatusText status={status} />
        </div>
      </form>
    </Card>
  );
}