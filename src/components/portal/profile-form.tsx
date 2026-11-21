"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import {
  portalSaveProfileAction,
  portalSaveProfileEssentialsAction,
  portalSkipProfileAction,
  type PortalResult,
} from "@/app/portal/actions";
import { OnboardingShell } from "@/components/portal/onboarding-shell";
import { Field, INPUT, PRIMARY, SECONDARY, StatusText } from "@/components/portal/portal-ui";
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
  hint,
  options,
  value,
  onChange,
  optional,
}: {
  label: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <div className="mb-2.5">
        <span className="text-dash-foreground block text-sm font-semibold">
          {label}
          {optional ? <span className="text-dash-muted-foreground font-normal"> · optional</span> : null}
        </span>
        {hint ? <p className="text-dash-muted-foreground mt-0.5 text-xs leading-relaxed">{hint}</p> : null}
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(value === o.value ? "" : o.value)}
              className={`min-h-11 max-w-full rounded-xl px-3.5 py-2.5 text-left text-sm leading-snug font-semibold break-words whitespace-normal transition-all sm:min-h-0 sm:px-4 sm:text-center ${
                active
                  ? "bg-dash-accent text-white shadow-sm"
                  : "border-dash-border bg-dash-muted/30 text-dash-muted-foreground hover:border-dash-accent/40 hover:text-dash-foreground border"
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

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-dash-border bg-dash-canvas/40 box-border w-full min-w-0 max-w-full space-y-3 overflow-x-clip rounded-2xl border p-3.5 sm:p-5">
      <div className="min-w-0">
        <h3 className="text-dash-foreground text-sm font-semibold tracking-tight">{title}</h3>
        {hint ? <p className="text-dash-muted-foreground mt-0.5 text-xs leading-relaxed break-words">{hint}</p> : null}
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </section>
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
  const afterSavePath = editMode ? "/portal/home?tab=account" : "/portal/packs#plans";

  function goNext() {
    window.location.assign(afterSavePath);
  }

  if (editMode) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-5 sm:mb-8">
          <p className="text-dash-accent text-[11px] font-semibold tracking-[0.16em] uppercase">Account</p>
          <h1 className="text-dash-foreground mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Course & institution
          </h1>
          <p className="text-dash-muted-foreground mt-1.5 text-sm leading-relaxed">
            Keep your college details up to date. Search to find yours quickly.
          </p>
        </div>
        <div className="border-dash-border bg-dash-card w-full min-w-0 max-w-full overflow-x-clip rounded-2xl border p-3.5 sm:rounded-3xl sm:p-7">
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
                if (res.ok && editMode) goNext();
              });
            }}
            showAccountFields
            submitLabel="Save changes"
            extraActions={
              cancelHref ? (
                <a href={cancelHref} className={`${SECONDARY} w-full sm:w-auto`}>
                  Cancel
                </a>
              ) : null
            }
          />
        </div>
      </div>
    );
  }

  const step = onboardingStep === "essentials" ? 1 : 2;

  return (
    <OnboardingShell step={step}>
      <div className="border-dash-border bg-dash-card w-full min-w-0 max-w-full overflow-x-clip rounded-2xl border p-3.5 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.35)] sm:p-6">
        <p className="text-dash-muted-foreground text-[10px] font-semibold tracking-[0.2em] uppercase">
          Step {step} of 2
        </p>
        <h2 className="text-dash-foreground mt-1.5 text-xl font-semibold tracking-tight">
          {onboardingStep === "essentials" ? "Account credentials" : "Course & institution"}
        </h2>
        <p className="text-dash-muted-foreground mt-1 mb-5 text-sm leading-relaxed">
          {onboardingStep === "essentials"
            ? "Full name and mobile number for payments."
            : "Tell us where you study. You can skip and finish later."}
        </p>

        {onboardingStep === "essentials" ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setStatus(null);
              startTransition(async () => {
                const res = await portalSaveProfileEssentialsAction({
                  fullName: String(fd.get("fullName") ?? ""),
                  phone: String(fd.get("phone") ?? ""),
                });
                if (res.ok) {
                  setStatus(null);
                  setOnboardingStep("academic");
                  router.refresh();
                } else {
                  setStatus(res);
                }
              });
            }}
          >
            <Field label="Full name *">
              <input
                name="fullName"
                required
                maxLength={120}
                autoComplete="name"
                className={INPUT}
                defaultValue={profile?.fullName ?? suggestedName ?? ""}
              />
            </Field>
            <Field label="Phone (mobile money) *">
              <input
                name="phone"
                required
                maxLength={30}
                inputMode="tel"
                autoComplete="tel"
                placeholder="07XX XXX XXX"
                className={INPUT}
                defaultValue={profile?.phone ?? ""}
              />
            </Field>
            <div className="mt-1 flex flex-col gap-2">
              <button type="submit" disabled={pending} className={`${PRIMARY} w-full`}>
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
                if (res.ok) {
                  goNext();
                } else {
                  setStatus(res);
                }
              });
            }}
            submitLabel="Save and continue"
            extraActions={
              <button
                type="button"
                disabled={pending}
                className={`${SECONDARY} w-full sm:w-auto`}
                onClick={() => {
                  setStatus(null);
                  startTransition(async () => {
                    const res = await portalSkipProfileAction();
                    if (!res.ok) setStatus(res);
                  });
                }}
              >
                {pending ? <Spinner /> : null}
                Skip for now
              </button>
            }
          />
        )}
      </div>
    </OnboardingShell>
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
  submitLabel: string;
  extraActions?: ReactNode;
}) {
  return (
    <form
      className="w-full min-w-0 max-w-full space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const get = (k: string) => String(fd.get(k) ?? "");
        onSubmit(get);
      }}
    >
      {showAccountFields ? (
        <FormSection title="Your account" hint="Used for payments and support contact.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name *">
              <input
                name="fullName"
                required
                maxLength={120}
                autoComplete="name"
                className={INPUT}
                defaultValue={profile?.fullName ?? ""}
              />
            </Field>
            <Field label="Phone (optional)">
              <input
                name="phone"
                maxLength={30}
                inputMode="tel"
                autoComplete="tel"
                placeholder="07XX XXX XXX"
                className={INPUT}
                defaultValue={profile?.phone ?? ""}
              />
            </Field>
          </div>
        </FormSection>
      ) : profile ? (
        <>
          <input type="hidden" name="fullName" value={profile.fullName} />
          <input type="hidden" name="phone" value={profile.phone} />
        </>
      ) : null}

      <FormSection title="Institution" hint="Search your university or college. Choose Other if it is not listed.">
        <Field label="Where you study">
          <SearchSelect
            value={institutionChoice}
            onChange={setInstitutionChoice}
            placeholder="Select institution"
            searchPlaceholder="Search, e.g. UDSM or Mbeya"
            emptyText="Not in the list? Choose Other (type it)."
            options={[
              ...INSTITUTIONS.map((name) => ({ value: name, label: name })),
              { value: OTHER_OPTION, label: "Other (type it)" },
            ]}
          />
        </Field>
        {institutionChoice === OTHER_OPTION ? (
          <Field label="Your institution">
            <input
              name="institutionOther"
              maxLength={160}
              placeholder="Full name of your university or college"
              className={INPUT}
              defaultValue={institutionListed ? "" : savedInstitution}
            />
          </Field>
        ) : null}
      </FormSection>

      <FormSection title="Course" hint="Your programme or department. Search by name or code.">
        <Field label="What you study">
          <SearchSelect
            value={courseChoice}
            onChange={setCourseChoice}
            placeholder="Select course"
            searchPlaceholder="Search, e.g. Electrical or ETE"
            emptyText="Not in the list? Choose Other (type it)."
            options={[
              ...listedCourses.map((c) => ({ value: c.code, label: c.name, hint: c.code })),
              { value: OTHER_COURSE_CODE, label: "Other (type it)" },
            ]}
          />
        </Field>
        {courseChoice === OTHER_COURSE_CODE ? (
          <Field label="Your course *">
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
      </FormSection>

      <FormSection title="Study details" hint="Optional — helps show the right titles and plans.">
        <ChoiceChips
          label="Level of study"
          options={STUDY_LEVELS}
          value={studyLevel}
          onChange={setStudyLevel}
          optional
        />
        {studyLevel === "other" ? (
          <Field label="Your level of study *">
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

        <Field label="Academic year (optional)">
          <input
            name="academicYear"
            maxLength={20}
            placeholder="2026/2027"
            className={INPUT}
            defaultValue={profile?.academicYear ?? "2026/2027"}
          />
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
        <button type="submit" disabled={pending} aria-busy={pending} className={`${PRIMARY} w-full sm:w-auto`}>
          {pending ? <Spinner /> : null}
          {pending ? "Saving…" : submitLabel}
        </button>
        {extraActions}
        <StatusText status={status} />
      </div>
    </form>
  );
}
