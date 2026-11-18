"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import {
  portalSaveProfileAction,
  portalSaveProfileEssentialsAction,
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

export function ProfileForm({
  courses,
  profile,
  cancelHref,
  suggestedName,
  academicStepPending = false,
}: {
  courses: Course[];
  profile: StudentProfile | null;
  cancelHref?: string;
  suggestedName?: string | null;
  /** Step 1 done (name + phone); show course and institution only. */
  academicStepPending?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [pending, startTransition] = useTransition();
  const editMode = Boolean(profile) && !academicStepPending;
  const [onboardingStep, setOnboardingStep] = useState<"essentials" | "academic">(
    academicStepPending ? "academic" : "essentials",
  );

  const savedInstitution = profile?.institution ?? DEFAULT_INSTITUTION;
  const institutionListed = (INSTITUTIONS as readonly string[]).includes(savedInstitution);
  const [institutionChoice, setInstitutionChoice] = useState(institutionListed ? savedInstitution : OTHER_OPTION);
  const [courseChoice, setCourseChoice] = useState(profile?.courseCode ?? courses[0]?.code ?? "");
  const [studyLevel, setStudyLevel] = useState(profile?.studyLevel ?? "");
  const [projectCategory, setProjectCategory] = useState(profile?.projectCategory ?? "");

  const listedCourses = courses.filter((c) => c.code !== OTHER_COURSE_CODE);
  const afterSavePath = editMode ? "/portal/home?tab=account" : "/portal/titles";

  function goNext() {
    router.push(afterSavePath);
    router.refresh();
  }

  if (editMode) {
    return (
      <Card title="Edit your details" subtitle="Update your account and course details any time.">
        <AcademicDetailsForm
          courses={courses}
          profile={profile!}
          listedCourses={listedCourses}
          institutionChoice={institutionChoice}
          setInstitutionChoice={setInstitutionChoice}
          courseChoice={courseChoice}
          setCourseChoice={setCourseChoice}
          studyLevel={studyLevel}
          setStudyLevel={setStudyLevel}
          projectCategory={projectCategory}
          setProjectCategory={setProjectCategory}
          savedInstitution={savedInstitution}
          institutionListed={institutionListed}
          cancelHref={cancelHref}
          pending={pending}
          status={status}
          onSubmit={(get) => {
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
                academicYear: get("academicYear"),
              });
              setStatus(res);
              if (res.ok) goNext();
            });
          }}
          showAccountFields
          submitLabel="Save details"
          extraActions={cancelHref ? <a href={cancelHref} className={SECONDARY}>Cancel</a> : null}
        />
      </Card>
    );
  }

  return (
    <Card
      title={onboardingStep === "essentials" ? "Your account" : "Course & institution"}
      subtitle={
        onboardingStep === "essentials"
          ? "Step 1 of 2 — same for email and Google sign-in. Enter your full name and mobile number."
          : "Step 2 of 2 — pick your course and institution, or skip and set them later under My account."
      }
    >
      {onboardingStep === "essentials" ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setStatus(null);
            startTransition(async () => {
              const res = await portalSaveProfileEssentialsAction({
                fullName: String(fd.get("fullName") ?? ""),
                phone: String(fd.get("phone") ?? ""),
              });
              setStatus(res);
              if (res.ok) {
                setOnboardingStep("academic");
                router.refresh();
              }
            });
          }}
        >
          <p className="text-dash-muted-foreground text-xs font-semibold uppercase tracking-wide">Step 1 / 2</p>
          <Field label="Full name *">
            <input
              name="fullName"
              required
              maxLength={120}
              className={INPUT}
              defaultValue={profile?.fullName ?? suggestedName ?? ""}
            />
          </Field>
          <Field label="Phone (mobile money) *">
            <input
              name="phone"
              required
              maxLength={30}
              placeholder="07XX XXX XXX"
              className={INPUT}
              defaultValue={profile?.phone ?? ""}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className={PRIMARY}>
              {pending ? <Spinner /> : null}
              {pending ? "Saving…" : "Continue"}
            </button>
            <StatusText status={status} />
          </div>
        </form>
      ) : (
        <AcademicDetailsForm
          courses={courses}
          profile={profile}
          listedCourses={listedCourses}
          institutionChoice={institutionChoice}
          setInstitutionChoice={setInstitutionChoice}
          courseChoice={courseChoice}
          setCourseChoice={setCourseChoice}
          studyLevel={studyLevel}
          setStudyLevel={setStudyLevel}
          projectCategory={projectCategory}
          setProjectCategory={setProjectCategory}
          savedInstitution={savedInstitution}
          institutionListed={institutionListed}
          pending={pending}
          status={status}
          onSubmit={(get) => {
            setStatus(null);
            startTransition(async () => {
              const res = await portalSaveProfileAction({
                fullName: profile?.fullName ?? String(get("fullName") ?? suggestedName ?? ""),
                phone: profile?.phone ?? String(get("phone") ?? ""),
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
          stepBadge="Step 2 / 2"
          submitLabel="Save and continue"
          extraActions={
            <>
              <button
                type="button"
                disabled={pending}
                className={SECONDARY}
                onClick={() => {
                  setStatus(null);
                  startTransition(async () => {
                    const res = await portalSkipProfileAction();
                    setStatus(res);
                    if (res.ok) goNext();
                  });
                }}
              >
                {pending ? <Spinner /> : null}
                Skip for now
              </button>
            </>
          }
        />
      )}
    </Card>
  );
}

function AcademicDetailsForm({
  courses: _courses,
  profile,
  listedCourses,
  institutionChoice,
  setInstitutionChoice,
  courseChoice,
  setCourseChoice,
  studyLevel,
  setStudyLevel,
  projectCategory,
  setProjectCategory,
  savedInstitution,
  institutionListed,
  cancelHref: _cancelHref,
  pending,
  status,
  onSubmit,
  showAccountFields,
  stepBadge,
  submitLabel,
  extraActions,
}: {
  courses: Course[];
  profile: StudentProfile | null;
  listedCourses: Course[];
  institutionChoice: string;
  setInstitutionChoice: (v: string) => void;
  courseChoice: string;
  setCourseChoice: (v: string) => void;
  studyLevel: string;
  setStudyLevel: (v: string) => void;
  projectCategory: string;
  setProjectCategory: (v: string) => void;
  savedInstitution: string;
  institutionListed: boolean;
  cancelHref?: string;
  pending: boolean;
  status: PortalResult | null;
  onSubmit: (get: (key: string) => string) => void;
  showAccountFields?: boolean;
  stepBadge?: string;
  submitLabel: string;
  extraActions?: ReactNode;
}) {
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const get = (k: string) => String(fd.get(k) ?? "");
        onSubmit(get);
      }}
    >
      {stepBadge ? (
        <p className="text-dash-muted-foreground sm:col-span-2 text-xs font-semibold uppercase tracking-wide">{stepBadge}</p>
      ) : null}

      {showAccountFields ? (
        <>
          <Field label="Full name *">
            <input name="fullName" required maxLength={120} className={INPUT} defaultValue={profile?.fullName ?? ""} />
          </Field>
          <Field label="Phone (mobile money, optional)">
            <input name="phone" maxLength={30} placeholder="07XX XXX XXX" className={INPUT} defaultValue={profile?.phone ?? ""} />
          </Field>
        </>
      ) : profile ? (
        <>
          <input type="hidden" name="fullName" value={profile.fullName} />
          <input type="hidden" name="phone" value={profile.phone} />
        </>
      ) : null}

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
        {extraActions}
        <button type="submit" disabled={pending} aria-busy={pending} className={PRIMARY}>
          {pending ? <Spinner /> : null}
          {pending ? "Saving…" : submitLabel}
        </button>
        <StatusText status={status} />
      </div>
    </form>
  );
}