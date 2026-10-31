"use client";

import { useEffect, useMemo, useState } from "react";

type Course = "ETE" | "COE";

type SampleTitle = {
  id: string;
  course: Course;
  title: string;
  summary: string;
  takenByOther?: boolean;
};

type Profile = {
  fullName: string;
  regNo: string;
  phone: string;
  institution: string;
  course: Course;
  year: string;
  academicYear: string;
  partner: string;
};

type State = {
  step: "account" | "profile" | "titles" | "selected" | "payment";
  email: string;
  profile: Profile | null;
  selectedId: string | null;
  changeCredits: number;
};

const CHANGE_FEE_TSH = 10000;
const STORAGE_KEY = "honicTitlePortalSample";

const COURSE_LABEL: Record<Course, string> = {
  ETE: "Electronics and Telecommunication Engineering (ETE)",
  COE: "Computer Engineering (COE)",
};

const TITLES: SampleTitle[] = [
  { id: "t1", course: "ETE", title: "Solar Coin and Mobile-Money Phone Charging Kiosk with Per-Port Power Metering", summary: "Solar kiosk where each charging port is paid for and metered." },
  { id: "t2", course: "ETE", title: "Wearable Sensor Glove that Converts Tanzanian Sign Language to Speech in Clinics", summary: "Glove with bend and motion sensors that speaks signed words aloud." },
  { id: "t3", course: "ETE", title: "Smart Mining Helmet with Gas Detection, Fall Alarm, and LoRa Link to the Surface", summary: "Helmet unit that alerts the surface about gas and falls underground.", takenByOther: true },
  { id: "t4", course: "ETE", title: "Radar-Activated Smart Zebra Crossing with Solar LED Road Studs and Speeding Warning", summary: "Radar detects pedestrians and warns speeding drivers with LED studs." },
  { id: "t5", course: "ETE", title: "Solar River-Level and Rainfall Station Network for Community Flood Early Warning", summary: "River and rain stations that send flood warnings downstream." },
  { id: "t6", course: "ETE", title: "Digital Forest Canopy Densiometer with Fisheye Camera, Tilt Correction and GPS Tagging", summary: "Handheld device that measures forest canopy cover from a sky photo.", takenByOther: true },
  { id: "t7", course: "ETE", title: "Handheld Childhood Pneumonia Screening Device for Community Health Workers", summary: "Counts breathing rate and checks oxygen and temperature in children." },
  { id: "c1", course: "COE", title: "Clinic Queue and Appointment System with SMS Turn Alerts", summary: "Patients book a slot and get an SMS when their turn is near." },
  { id: "c2", course: "COE", title: "Offline-First Farm Records App with Sync for Agricultural Extension Officers", summary: "Mobile app that works without internet and syncs when signal returns." },
  { id: "c3", course: "COE", title: "Student Hostel Allocation and Maintenance Request Portal", summary: "Room allocation plus fault reporting with status tracking.", takenByOther: true },
  { id: "c4", course: "COE", title: "Small Shop Stock and Sales System with Mobile-Money Reconciliation", summary: "Point of sale that matches mobile-money payments to sales." },
  { id: "c5", course: "COE", title: "Fingerprint Exam Attendance and Seat Verification System", summary: "Verifies each candidate at the exam room door and logs attendance." },
];

const INITIAL: State = {
  step: "account",
  email: "",
  profile: null,
  selectedId: null,
  changeCredits: 0,
};

const INPUT =
  "border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2";
const PRIMARY = "bg-dash-accent rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const SECONDARY =
  "border-dash-border bg-dash-muted hover:bg-dash-border rounded-xl border px-4 py-2.5 text-sm font-semibold";

const STEPS: { key: State["step"]; label: string }[] = [
  { key: "account", label: "Create account" },
  { key: "profile", label: "Your details" },
  { key: "titles", label: "Choose title" },
  { key: "selected", label: "Your title" },
];

export function TitlePortalSample() {
  const [state, setState] = useState<State>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore sample progress once on mount
      if (raw) setState({ ...INITIAL, ...(JSON.parse(raw) as State) });
    } catch {
      /* ignore broken sample state */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const course = state.profile?.course ?? null;
  const courseTitles = useMemo(() => TITLES.filter((t) => t.course === course), [course]);
  const available = courseTitles.filter((t) => !t.takenByOther);
  const takenCount = courseTitles.length - available.length;
  const selected = TITLES.find((t) => t.id === state.selectedId) ?? null;
  const confirmTitle = TITLES.find((t) => t.id === confirmId) ?? null;

  function update(patch: Partial<State>) {
    setState((s) => ({ ...s, ...patch }));
  }

  if (!loaded) return null;

  const stepIndex = STEPS.findIndex((s) => s.key === (state.step === "payment" ? "selected" : state.step));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950 dark:text-amber-100">
        <span className="font-semibold">Sample only.</span> Nothing is saved to the database; titles and payment are
        simulated in this browser.{" "}
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem(STORAGE_KEY);
            setState(INITIAL);
          }}
          className="font-semibold underline underline-offset-2"
        >
          Reset sample
        </button>
      </div>

      <ol className="mb-8 grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.key} className="text-center">
            <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-dash-accent" : "bg-dash-border"}`} />
            <p className={`mt-1.5 text-[11px] font-semibold ${i <= stepIndex ? "text-dash-foreground" : "text-dash-muted-foreground"}`}>
              {s.label}
            </p>
          </li>
        ))}
      </ol>

      {state.step === "account" ? (
        <Card title="Create your student account" subtitle="Use your own email. You will sign in with it to see your title later.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              update({ email: String(fd.get("email") ?? ""), step: "profile" });
            }}
            className="grid gap-3"
          >
            <Field label="Email">
              <input name="email" type="email" required className={INPUT} defaultValue={state.email} />
            </Field>
            <Field label="Password">
              <input name="password" type="password" required minLength={8} className={INPUT} />
            </Field>
            <Field label="Confirm password">
              <input name="password2" type="password" required minLength={8} className={INPUT} />
            </Field>
            <button type="submit" className={PRIMARY}>
              Create account
            </button>
            <p className="text-dash-muted-foreground text-xs">
              Real version: a verification link is sent to this email before you can continue.
            </p>
          </form>
        </Card>
      ) : null}

      {state.step === "profile" ? (
        <Card title="Your details" subtitle="We show you only the titles for your course.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const get = (k: string) => String(fd.get(k) ?? "").trim();
              update({
                step: "titles",
                profile: {
                  fullName: get("fullName"),
                  regNo: get("regNo"),
                  phone: get("phone"),
                  institution: get("institution"),
                  course: get("course") === "COE" ? "COE" : "ETE",
                  year: get("year"),
                  academicYear: get("academicYear"),
                  partner: get("partner"),
                },
              });
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field label="Full name" wide>
              <input name="fullName" required className={INPUT} defaultValue={state.profile?.fullName} />
            </Field>
            <Field label="Registration number">
              <input name="regNo" required className={INPUT} defaultValue={state.profile?.regNo} />
            </Field>
            <Field label="Phone (mobile money)">
              <input name="phone" required placeholder="07XX XXX XXX" className={INPUT} defaultValue={state.profile?.phone} />
            </Field>
            <Field label="Institution">
              <input name="institution" required className={INPUT} defaultValue={state.profile?.institution ?? "Dar es Salaam Institute of Technology (DIT)"} />
            </Field>
            <Field label="Course">
              <select name="course" required className={INPUT} defaultValue={state.profile?.course ?? "ETE"}>
                <option value="ETE">{COURSE_LABEL.ETE}</option>
                <option value="COE">{COURSE_LABEL.COE}</option>
              </select>
            </Field>
            <Field label="Year of study">
              <select name="year" required className={INPUT} defaultValue={state.profile?.year ?? "Year 4 (NTA Level 8)"}>
                <option>Year 1 (NTA Level 7)</option>
                <option>Year 2 (NTA Level 7)</option>
                <option>Year 3 (NTA Level 8)</option>
                <option>Year 4 (NTA Level 8)</option>
              </select>
            </Field>
            <Field label="Academic year">
              <input name="academicYear" required className={INPUT} defaultValue={state.profile?.academicYear ?? "2026/2027"} />
            </Field>
            <Field label="Group partner (optional)" wide>
              <input name="partner" className={INPUT} placeholder="Name and registration number" defaultValue={state.profile?.partner} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <button type="button" onClick={() => update({ step: "account" })} className={SECONDARY}>
                Back
              </button>
              <button type="submit" className={PRIMARY}>
                Save and see titles
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {state.step === "titles" && state.profile ? (
        <Card
          title={`Titles for ${state.profile.course}`}
          subtitle={`${available.length} available · ${takenCount} already taken by other students. You can hold one title at a time.`}
        >
          {state.changeCredits > 0 ? (
            <p className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
              Payment received. Pick your new title.
            </p>
          ) : null}
          <ul className="space-y-3">
            {available.map((t) => (
              <li key={t.id} className="border-dash-border rounded-xl border p-4">
                <p className="text-dash-foreground font-semibold leading-snug">{t.title}</p>
                <p className="text-dash-muted-foreground mt-1 text-sm">{t.summary}</p>
                <button type="button" onClick={() => setConfirmId(t.id)} className={`${PRIMARY} mt-3 px-3 py-1.5 text-xs`}>
                  Select this title
                </button>
              </li>
            ))}
            {available.length === 0 ? (
              <li className="text-dash-muted-foreground py-6 text-center text-sm">No titles left for your course.</li>
            ) : null}
          </ul>
        </Card>
      ) : null}

      {state.step === "selected" && selected && state.profile ? (
        <Card title="Your project title" subtitle="This title is now yours. Other students can no longer see it.">
          <div className="border-dash-accent/40 bg-dash-accent/5 rounded-xl border p-4">
            <p className="text-dash-foreground text-lg font-semibold leading-snug">{selected.title}</p>
            <p className="text-dash-muted-foreground mt-1 text-sm">{selected.summary}</p>
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Student" value={`${state.profile.fullName} (${state.profile.regNo})`} />
            <Info label="Course" value={COURSE_LABEL[state.profile.course]} />
            <Info label="Year" value={`${state.profile.year}, ${state.profile.academicYear}`} />
            <Info label="Account" value={state.email} />
            {state.profile.partner ? <Info label="Partner" value={state.profile.partner} /> : null}
          </dl>
          <div className="border-dash-border mt-5 border-t pt-4">
            <p className="text-dash-muted-foreground text-sm">
              Want a different title? Changing costs <span className="text-dash-foreground font-semibold">TSh {CHANGE_FEE_TSH.toLocaleString()}</span>.
              Your current title goes back to the list for others.
            </p>
            <button type="button" onClick={() => update({ step: "payment" })} className={`${SECONDARY} mt-3`}>
              Pay to change title
            </button>
          </div>
        </Card>
      ) : null}

      {state.step === "payment" && selected && state.profile ? (
        <PaymentStep
          phone={state.profile.phone}
          onCancel={() => update({ step: "selected" })}
          onPaid={() =>
            update({
              step: "titles",
              selectedId: null,
              changeCredits: state.changeCredits + 1,
            })
          }
        />
      ) : null}

      {confirmTitle ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="bg-dash-card border-dash-border w-full max-w-md rounded-2xl border p-5 shadow-xl">
            <p className="text-dash-foreground font-semibold">Select this title?</p>
            <p className="text-dash-foreground mt-2 text-sm">{confirmTitle.title}</p>
            <p className="text-dash-muted-foreground mt-3 text-sm">
              All other titles will be hidden from you, and this one will be hidden from everyone else. Changing later
              costs TSh {CHANGE_FEE_TSH.toLocaleString()}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmId(null)} className={SECONDARY}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  update({
                    step: "selected",
                    selectedId: confirmTitle.id,
                    changeCredits: Math.max(0, state.changeCredits - 1),
                  });
                  setConfirmId(null);
                }}
                className={PRIMARY}
              >
                Yes, select it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PaymentStep({ phone, onCancel, onPaid }: { phone: string; onCancel: () => void; onPaid: () => void }) {
  const [phase, setPhase] = useState<"form" | "waiting">("form");

  return (
    <Card title="Pay to change your title" subtitle={`Amount: TSh ${CHANGE_FEE_TSH.toLocaleString()}`}>
      {phase === "form" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPhase("waiting");
            window.setTimeout(onPaid, 2500);
          }}
          className="grid gap-3"
        >
          <Field label="Pay with">
            <select className={INPUT} defaultValue="M-Pesa">
              <option>M-Pesa</option>
              <option>Mixx by Yas (Tigo Pesa)</option>
              <option>Airtel Money</option>
              <option>HaloPesa</option>
            </select>
          </Field>
          <Field label="Mobile money number">
            <input required className={INPUT} defaultValue={phone} />
          </Field>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className={SECONDARY}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY}>
              Send payment request
            </button>
          </div>
        </form>
      ) : (
        <div className="py-6 text-center">
          <p className="text-dash-foreground font-semibold">Check your phone</p>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            Enter your mobile money PIN to approve TSh {CHANGE_FEE_TSH.toLocaleString()}. (Sample: approves automatically.)
          </p>
        </div>
      )}
    </Card>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="border-dash-border bg-dash-card rounded-2xl border p-5 shadow-sm sm:p-6">
      <h2 className="text-dash-foreground text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="text-dash-muted-foreground mt-1 mb-4 text-sm">{subtitle}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? "sm:col-span-2" : undefined}>
      <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-dash-muted-foreground text-[11px] font-semibold uppercase">{label}</dt>
      <dd className="text-dash-foreground">{value}</dd>
    </div>
  );
}
