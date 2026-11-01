"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  createProjectFromTitleAction,
  createTitleProposalAction,
  deleteTitleProposalAction,
  setTitleProposalStatusAction,
} from "@/app/titles/actions";
import type { TitleProposal, TitleProposalStatus } from "@/lib/title-bank";

type ActionState = { type: "ok" | "error"; message: string } | null;
type Filter = "all" | TitleProposalStatus;

const STATUS_LABEL: Record<TitleProposalStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  assigned: "Assigned",
  dropped: "Dropped",
};

const STATUS_BADGE: Record<TitleProposalStatus, string> = {
  available: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  reserved: "border-amber-500/45 bg-amber-500/15 text-amber-900 dark:text-amber-200",
  assigned: "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  dropped: "border-dash-border bg-dash-muted/30 text-dash-muted-foreground",
};

const FILTERS: Filter[] = ["all", "available", "reserved", "assigned", "dropped"];

const INPUT =
  "border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2";
const BTN =
  "border-dash-border bg-dash-muted hover:bg-dash-border rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50";

export function TitleProposalsBoard({
  proposals,
  courses,
}: {
  proposals: TitleProposal[];
  courses: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("available");
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionState>(null);
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: proposals.length, available: 0, reserved: 0, assigned: 0, dropped: 0 };
    for (const p of proposals) c[p.status] += 1;
    return c;
  }, [proposals]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proposals.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (!q) return true;
      return [p.title, p.originalTitle, p.originRef, p.batch, p.assignedTo, p.summary]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [proposals, filter, query]);

  function run(id: string, action: () => Promise<void>, okMessage = "Saved.") {
    setPendingId(id);
    setStatus(null);
    startTransition(async () => {
      try {
        await action();
        setStatus({ type: "ok", message: okMessage });
      } catch (err) {
        setStatus({ type: "error", message: err instanceof Error ? err.message : "Action failed." });
      } finally {
        setPendingId(null);
        router.refresh();
      }
    });
  }

  function holdFor(p: TitleProposal, next: "reserved" | "assigned") {
    const name = window.prompt(
      next === "reserved" ? "Reserve this title for (name):" : "Assign this title to (student or team):",
      p.assignedTo ?? "",
    );
    if (name === null) return;
    run(p.id, () => setTitleProposalStatusAction(p.id, next, name));
  }

  function onCreate(form: HTMLFormElement) {
    const fd = new FormData(form);
    run(
      "new",
      async () => {
        await createTitleProposalAction({
          title: String(fd.get("title") ?? ""),
          courseCode: String(fd.get("courseCode") ?? ""),
          originalTitle: String(fd.get("originalTitle") ?? ""),
          originRef: String(fd.get("originRef") ?? ""),
          summary: String(fd.get("summary") ?? ""),
          hardware: String(fd.get("hardware") ?? ""),
          communication: String(fd.get("communication") ?? ""),
        });
        form.reset();
        setShowForm(false);
      },
      "Title added.",
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "bg-dash-accent rounded-full px-3 py-1 text-xs font-semibold text-white"
                : "border-dash-border bg-dash-card text-dash-muted-foreground hover:bg-dash-muted rounded-full border px-3 py-1 text-xs font-semibold"
            }
          >
            {f === "all" ? "All" : STATUS_LABEL[f]} · {counts[f]}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, origin, or name"
          className={`${INPUT} ml-auto max-w-xs py-1.5`}
        />
        <button type="button" onClick={() => setShowForm((v) => !v)} className={`${BTN} py-1.5`}>
          {showForm ? "Close form" : "Add new title"}
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(e.currentTarget);
          }}
          className="border-dash-border bg-dash-card grid gap-3 rounded-2xl border p-4 shadow-sm sm:grid-cols-2"
        >
          <label>
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">New title *</span>
            <input name="title" required maxLength={300} className={INPUT} />
          </label>
          <label>
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Course *</span>
            <select name="courseCode" required className={INPUT} defaultValue={courses[0]?.code}>
              {courses
                .filter((c) => c.code !== "OTHER")
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Original title</span>
            <input name="originalTitle" maxLength={300} className={INPUT} placeholder="Leave empty for a new idea" />
          </label>
          <label>
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Origin</span>
            <input name="originRef" maxLength={100} className={INPUT} placeholder="e.g. COE No. 12 or New idea" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">What it is</span>
            <textarea name="summary" rows={2} className={INPUT} />
          </label>
          <label>
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Hardware to design</span>
            <textarea name="hardware" rows={2} className={INPUT} />
          </label>
          <label>
            <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Communication</span>
            <textarea name="communication" rows={2} className={INPUT} />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isPending && pendingId === "new"}
              className="bg-dash-accent rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save title
            </button>
          </div>
        </form>
      ) : null}

      {status ? (
        <p
          role="status"
          className={status.type === "ok" ? "text-sm text-emerald-600 dark:text-emerald-300" : "text-sm text-red-600 dark:text-red-300"}
        >
          {status.message}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="border-dash-border bg-dash-card rounded-2xl border px-5 py-10 text-center">
          <p className="text-dash-muted-foreground text-sm">No titles match this filter.</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((p) => {
            const busy = isPending && pendingId === p.id;
            return (
              <li key={p.id} className="border-dash-border bg-dash-card flex flex-col rounded-2xl border p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                    {p.assignedTo && (p.status === "reserved" || p.status === "assigned") ? ` · ${p.assignedTo}` : ""}
                  </span>
                  {p.courseCode ? (
                    <span className="bg-dash-accent/10 text-dash-accent inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold">
                      {p.courseCode}
                    </span>
                  ) : null}
                  {p.originRef ? (
                    <span className="border-dash-border text-dash-muted-foreground inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                      {p.originRef}
                    </span>
                  ) : null}
                  {p.batch ? <span className="text-dash-muted-foreground text-[11px]">{p.batch}</span> : null}
                </div>

                <p className="text-dash-foreground mt-2 font-semibold leading-snug">{p.title}</p>
                <p className="text-dash-muted-foreground mt-1 text-xs">Original title: {p.originalTitle ?? "None"}</p>
                {p.student ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs">
                    <span className="text-dash-foreground font-semibold">Student: {p.student.fullName}</span>
                    <span className="text-dash-muted-foreground">
                      {[p.student.regNo, p.student.phone].filter(Boolean).join(" · ")}
                    </span>
                    {p.student.trackedProjectId ? (
                      <Link
                        href={`/projects/${p.student.trackedProjectId}`}
                        className="text-dash-accent ml-auto font-semibold underline-offset-2 hover:underline"
                      >
                        Open project
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending && pendingId === p.id}
                        onClick={() => {
                          if (!window.confirm(`Create a project for ${p.student?.fullName} and link their portal account?`)) return;
                          run(p.id, async () => {
                            const projectId = await createProjectFromTitleAction(p.id);
                            router.push(`/projects/${projectId}`);
                          }, "Project created and linked.");
                        }}
                        className="bg-dash-accent ml-auto rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Create project
                      </button>
                    )}
                  </div>
                ) : null}

                {p.summary || p.hardware || p.communication ? (
                  <details className="mt-2 text-sm">
                    <summary className="text-dash-accent cursor-pointer text-xs font-semibold">Details</summary>
                    <dl className="mt-2 space-y-2">
                      {p.summary ? <Detail label="What it is" value={p.summary} /> : null}
                      {p.hardware ? <Detail label="Hardware to design" value={p.hardware} /> : null}
                      {p.communication ? <Detail label="Communication" value={p.communication} /> : null}
                    </dl>
                  </details>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  {p.status === "available" ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => holdFor(p, "reserved")} className={BTN}>
                        Reserve
                      </button>
                      <button type="button" disabled={busy} onClick={() => holdFor(p, "assigned")} className={BTN}>
                        Assign
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(p.id, () => setTitleProposalStatusAction(p.id, "dropped"))}
                        className={BTN}
                      >
                        Drop
                      </button>
                    </>
                  ) : null}
                  {p.status === "reserved" ? (
                    <button type="button" disabled={busy} onClick={() => holdFor(p, "assigned")} className={BTN}>
                      Assign
                    </button>
                  ) : null}
                  {p.status !== "available" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(p.id, () => setTitleProposalStatusAction(p.id, "available"))}
                      className={BTN}
                    >
                      {p.status === "dropped" ? "Restore" : "Release"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Delete "${p.title}"?`)) return;
                      run(p.id, () => deleteTitleProposalAction(p.id), "Title deleted.");
                    }}
                    className="ml-auto rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-dash-muted-foreground text-[11px] font-semibold uppercase">{label}</dt>
      <dd className="text-dash-foreground">{value}</dd>
    </div>
  );
}
