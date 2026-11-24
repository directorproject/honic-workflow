"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { submitOwnershipClaim } from "@/app/portal/title-claim-actions";
import { OWNERSHIP_QUESTIONS, type OwnershipCatalogueItem } from "@/lib/portal/title-claims";

const INPUT = "border-dash-border bg-dash-muted/30 mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none";
const LABEL = "text-dash-muted-foreground text-xs font-semibold uppercase";
const FILE =
  `${INPUT} file:mr-3 file:rounded-lg file:border-0 file:bg-dash-foreground file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`;
const MAX_CLAIM_FILES = 12;

type ProofWay = "upload" | "questions";

function syncFileInput(input: HTMLInputElement | null, files: File[]) {
  if (!input) return;
  const dt = new DataTransfer();
  for (const file of files) dt.items.add(file);
  input.files = dt.files;
}

function MultiFileField({
  name,
  label,
  accept,
  files,
  onChange,
  help,
}: {
  name: string;
  label: string;
  accept: string;
  files: File[];
  onChange: (files: File[]) => void;
  help?: string;
}) {
  const submitRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    syncFileInput(submitRef.current, files);
  }, [files]);

  return (
    <div className="space-y-2">
      <span className={LABEL}>{label}</span>
      {help ? <p className="text-dash-muted-foreground text-sm">{help}</p> : null}
      <input ref={submitRef} type="file" name={name} multiple className="hidden" tabIndex={-1} aria-hidden />
      <input
        ref={pickerRef}
        type="file"
        multiple
        accept={accept}
        className={FILE}
        onChange={(e) => {
          const added = Array.from(e.target.files ?? []).filter((f) => f.size > 0);
          if (!added.length) return;
          const merged = [...files];
          for (const file of added) {
            if (merged.length >= MAX_CLAIM_FILES) break;
            if (merged.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) continue;
            merged.push(file);
          }
          onChange(merged);
          e.target.value = "";
        }}
      />
      {files.length ? (
        <ul className="border-dash-border divide-dash-border divide-y rounded-xl border">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-dash-foreground min-w-0 truncate font-medium">{file.name}</span>
              <button
                type="button"
                className="text-dash-muted-foreground hover:text-dash-foreground shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-dash-muted-foreground text-xs">No files yet. You can add more than one.</p>
      )}
      {files.length >= MAX_CLAIM_FILES ? (
        <p className="text-dash-muted-foreground text-xs">Maximum {MAX_CLAIM_FILES} files.</p>
      ) : files.length ? (
        <button
          type="button"
          className="text-dash-accent text-sm font-semibold underline-offset-2 hover:underline"
          onClick={() => pickerRef.current?.click()}
        >
          Add more files
        </button>
      ) : null}
    </div>
  );
}

/** Strip copy/paste noise so a title pasted from the list still matches. */
function normalizeTitle(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-zA-Z0-9\s\-./&+:'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function scoreMatch(query: string, title: string): number {
  const q = normalizeTitle(query);
  const t = normalizeTitle(title);
  if (!q || q.length < 3 || !t) return 0;
  if (t === q) return 100;
  if (t.includes(q) || q.includes(t)) return 90;
  const qWords = q.split(" ").filter((w) => w.length > 2);
  const tWords = new Set(t.split(" ").filter((w) => w.length > 2));
  if (!qWords.length) return 0;
  const hit = qWords.filter((w) => tWords.has(w) || [...tWords].some((tw) => tw.includes(w) || w.includes(tw))).length;
  const ratio = hit / qWords.length;
  if (ratio >= 0.7) return Math.round(50 + ratio * 40);
  if (ratio >= 0.45) return Math.round(20 + ratio * 40);
  return 0;
}

export function TitleClaimForm({ catalogue }: { catalogue: OwnershipCatalogueItem[] }) {
  const [query, setQuery] = useState("");
  const [targetRouteId, setTargetRouteId] = useState("");
  const [asNew, setAsNew] = useState(false);
  const [proofWay, setProofWay] = useState<ProofWay>("upload");
  const [step, setStep] = useState<1 | 2>(1);
  const [projectDocs, setProjectDocs] = useState<File[]>([]);
  const [idProofs, setIdProofs] = useState<File[]>([]);

  const matches = useMemo(() => {
    if (normalizeTitle(query).length < 3) return [];
    return catalogue
      .map((item) => ({ item, score: scoreMatch(query, item.title) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .slice(0, 20)
      .map((row) => row.item);
  }, [catalogue, query]);

  const selected = catalogue.find((item) => item.routeId === targetRouteId) ?? null;
  const isAppeal = Boolean(selected?.owned);
  const mode = asNew ? "new" : isAppeal ? "appeal" : "claim";
  const readyForDocs = asNew ? normalizeTitle(query).length >= 8 : Boolean(selected);
  const locked = Boolean(selected) || asNew;
  const showResults = !locked && normalizeTitle(query).length >= 3;

  function clearSelection() {
    setTargetRouteId("");
    setAsNew(false);
    setStep(1);
  }

  return (
    <form action={submitOwnershipClaim} className="space-y-8">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="proofMethod" value={proofWay} />
      {asNew ? <input type="hidden" name="title" value={query.trim()} /> : null}
      {targetRouteId ? <input type="hidden" name="targetRouteId" value={targetRouteId} /> : null}

      <section className="space-y-3">
        <StepLabel n={1} title="Search your title" />
        <p className="text-dash-muted-foreground text-sm">
          Paste or type the title from final year titles. Matching titles appear as you type, then select one.
          {catalogue.length ? (
            <span className="text-dash-muted-foreground"> ({catalogue.length} titles loaded)</span>
          ) : (
            <span className="text-rose-600 dark:text-rose-300"> Title list failed to load. Refresh the page.</span>
          )}
        </p>

        {locked ? (
          <div
            className={`rounded-xl border px-3 py-3 text-sm ${
              selected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                : "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100"
            }`}
          >
            <p>
              {selected ? "Selected title" : "New title"}:{" "}
              <span className="font-semibold">{selected ? selected.title : query.trim()}</span>
              {isAppeal ? " (this will be an appeal)" : null}
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold underline-offset-4 hover:underline"
              onClick={clearSelection}
            >
              Change selection
            </button>
          </div>
        ) : (
          <>
            <label className="block text-sm">
              <span className={LABEL}>Title</span>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setTargetRouteId("");
                  setAsNew(false);
                  setStep(1);
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (!pasted) return;
                  e.preventDefault();
                  const cleaned = pasted.replace(/\s+/g, " ").trim();
                  setQuery(cleaned);
                  setTargetRouteId("");
                  setAsNew(false);
                  setStep(1);
                }}
                className={INPUT}
                placeholder="Paste or type the project title"
                autoComplete="off"
              />
            </label>

            {showResults ? (
              <div className="space-y-2">
                {matches.length ? (
                  <ul className="divide-dash-border border-dash-border divide-y rounded-xl border">
                    {matches.map((item) => (
                      <li key={item.routeId}>
                        <button
                          type="button"
                          className="hover:bg-dash-muted/40 w-full px-3 py-3 text-left"
                          onClick={() => {
                            setTargetRouteId(item.routeId);
                            setQuery(item.title);
                            setAsNew(false);
                            setStep(2);
                          }}
                        >
                          <span className="text-dash-foreground block text-sm font-semibold leading-snug">{item.title}</span>
                          <span className="text-dash-muted-foreground mt-1 block text-xs">
                            {item.owned ? "Already owned. Appeal if it is yours." : "Available to claim"}
                            {item.yearLabel ? ` (${item.yearLabel})` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-dash-muted-foreground text-sm">
                    No close match yet. Try fewer words from the middle of the title, or continue as new.
                  </p>
                )}

                <button
                  type="button"
                  className="text-dash-foreground text-sm font-semibold underline-offset-4 hover:underline"
                  onClick={() => {
                    setAsNew(true);
                    setTargetRouteId("");
                    setStep(2);
                  }}
                >
                  No match. Continue as a new title
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {readyForDocs && step >= 2 ? (
        <>
          <section className="space-y-3">
            <StepLabel n={2} title="Project documents" />
            <MultiFileField
              name="projectDocuments"
              label="Files"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/*"
              files={projectDocs}
              onChange={setProjectDocs}
              help="Add PPT, PDF, Word, or images. You can keep adding files, then submit all together."
            />
          </section>

          <section className="space-y-3">
            <StepLabel n={3} title="Prove ownership" />
            <div className="flex flex-wrap gap-2">
              <Chip active={proofWay === "upload"} onClick={() => setProofWay("upload")} label="Upload ID or proof image" />
              <Chip active={proofWay === "questions"} onClick={() => setProofWay("questions")} label="Answer questions" />
            </div>

            {proofWay === "upload" ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className={LABEL}>ID number (optional)</span>
                  <input name="idNumber" maxLength={80} className={INPUT} placeholder="If the proof shows a number" />
                </label>
                <MultiFileField
                  name="idProofs"
                  label="Proof files"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                  files={idProofs}
                  onChange={setIdProofs}
                  help="Send a national ID, student ID, passport photo, or any image that proves you own this title. Add more than one if needed."
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-dash-muted-foreground text-sm">Answer these. Admin will check if they look true.</p>
                {OWNERSHIP_QUESTIONS.map((question) => (
                  <label key={question.id} className="block text-sm">
                    <span className={LABEL}>{question.label}</span>
                    <textarea name={`answer_${question.id}`} required minLength={2} rows={2} className={INPUT} />
                  </label>
                ))}
              </div>
            )}
          </section>

          {isAppeal ? (
            <p className="text-dash-muted-foreground text-sm">
              This title already has an owner. Your claim is an appeal. Admin will compare your proof before changing ownership.
            </p>
          ) : null}

          {!projectDocs.length ? (
            <p className="text-sm text-rose-600 dark:text-rose-300">Add at least one project document before you submit.</p>
          ) : null}
          {proofWay === "upload" && !idProofs.length ? (
            <p className="text-sm text-rose-600 dark:text-rose-300">Add at least one ownership proof file, or switch to Answer questions.</p>
          ) : null}

          <button
            type="submit"
            disabled={!projectDocs.length || (proofWay === "upload" && !idProofs.length)}
            className="bg-dash-accent rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Submit for review
          </button>
        </>
      ) : null}
    </form>
  );
}

function StepLabel({ n, title }: { n: number; title: string }) {
  return (
    <h3 className="text-dash-foreground text-sm font-semibold tracking-tight">
      <span className="text-dash-muted-foreground mr-2 tabular-nums">{n}.</span>
      {title}
    </h3>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
        active
          ? "border-dash-foreground bg-dash-foreground text-dash-card"
          : "border-dash-border text-dash-muted-foreground hover:text-dash-foreground"
      }`}
    >
      {label}
    </button>
  );
}
