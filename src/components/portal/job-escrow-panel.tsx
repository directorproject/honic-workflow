"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { PortalResult } from "@/app/portal/auth-actions";
import {
  portalEscrowConfirmAction,
  portalEscrowDisputeAction,
  portalEscrowPreviewTokenAction,
  portalEscrowRegisterUploadAction,
  portalEscrowRevisionAction,
  portalEscrowUploadUrlAction,
  portalSavePeerPayoutAction,
  portalUseSavedPayoutAction,
} from "@/app/portal/job-actions";
import { PAYMENT_NETWORKS } from "@/lib/portal/config";
import {
  ESCROW_DELIVERY_HOURS,
  ESCROW_MAX_REVISIONS,
  ESCROW_REVIEW_HOURS,
  escrowStatusLabel,
  peerHelpActivitySteps,
  type PortalJobDeliverableMeta,
  type PortalJobEscrow,
  type PortalJobEscrowEvent,
} from "@/lib/portal/job-escrow-shared";
import { toUserError } from "@/lib/portal/user-errors";

const CARD = "rounded-2xl border border-dash-border bg-dash-surface shadow-sm";
const INPUT =
  "w-full rounded-xl border border-dash-border bg-dash-canvas px-3 py-2.5 text-sm text-dash-foreground outline-none focus:border-dash-accent";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-dash-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";
const SOFT =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-dash-border bg-dash-muted/40 px-4 py-2.5 text-sm font-semibold text-dash-foreground disabled:opacity-60";

function formatTsh(n: number) {
  return `TSh ${Math.round(n).toLocaleString()}`;
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function JobEscrowPanel({
  escrow,
  deliverables,
  events = [],
  peerPayoutSaved,
  savedPayout = null,
  isStaff = false,
}: {
  escrow: PortalJobEscrow;
  deliverables: PortalJobDeliverableMeta[];
  events?: PortalJobEscrowEvent[];
  peerPayoutSaved: boolean;
  /** Helper's general payout account (masked), offered as a one-tap payout number. */
  savedPayout?: { network: string; phoneTail: string } | null;
  isStaff?: boolean;
}) {
  const preview = deliverables.find((d) => d.kind === "preview") ?? null;
  const finalFile = deliverables.find((d) => d.kind === "final") ?? null;
  const steps = peerHelpActivitySteps(escrow, deliverables);
  const reviewMs = escrow.reviewDeadlineAt ? new Date(escrow.reviewDeadlineAt).getTime() : null;
  const deliveryMs = escrow.deliveryDeadlineAt ? new Date(escrow.deliveryDeadlineAt).getTime() : null;
  const reviewHoursLeft =
    reviewMs && escrow.status === "delivered" ? Math.max(0, Math.ceil((reviewMs - Date.now()) / 3600000)) : null;
  const deliveryHoursLeft =
    deliveryMs && escrow.status === "locked" ? Math.max(0, Math.ceil((deliveryMs - Date.now()) / 3600000)) : null;

  return (
    <section className={`${CARD} space-y-4 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-dash-muted-foreground text-xs font-semibold tracking-wide uppercase">Protected escrow</p>
          <h2 className="text-dash-foreground mt-1 text-lg font-bold">{escrowStatusLabel(escrow.status)}</h2>
          <p className="text-dash-muted-foreground mt-1 text-sm">
            Locked amount <span className="text-dash-foreground font-semibold tabular-nums">{formatTsh(escrow.amountTsh)}</span>
            {reviewHoursLeft != null ? ` · auto-release in ~${reviewHoursLeft}h if no action` : null}
            {deliveryHoursLeft != null ? ` · deliver within ~${deliveryHoursLeft}h or auto-refund` : null}
          </p>
        </div>
        <span className="rounded-full bg-dash-muted px-3 py-1 text-[11px] font-semibold text-dash-muted-foreground">
          ESC {escrow.publicId.slice(0, 8)}
        </span>
      </div>

      {escrow.isHelper && !peerPayoutSaved && (escrow.status === "locked" || escrow.status === "delivered") ? (
        <PickedPayoutCard amountTsh={escrow.amountTsh} savedPayout={savedPayout} />
      ) : null}

      <PeerHelpActivityTrack steps={steps} />
      <SharedActivityFeed events={events} />

      {escrow.revisionNote && escrow.status === "locked" ? (
        <p className="rounded-xl border border-dash-border bg-amber-500/10 px-3 py-2 text-xs text-dash-foreground">
          <span className="font-semibold">Needs fix{escrow.revisionCount ? ` (${escrow.revisionCount}/${ESCROW_MAX_REVISIONS})` : ""}:</span>{" "}
          {escrow.revisionNote}
        </p>
      ) : null}

      {escrow.isPoster && (escrow.status === "funded" || escrow.status === "locked" || escrow.status === "delivered") ? (
        <p className="rounded-xl border border-dash-border bg-dash-muted/30 px-3 py-2 text-xs text-dash-foreground">
          <span className="font-semibold">Your money:</span> {formatTsh(escrow.amountTsh)} is held by Honic escrow — not sent to the
          helper yet. It only moves after you release, auto-release, refund, or a Honic dispute decision.
        </p>
      ) : null}

      {escrow.isHelper && (escrow.status === "locked" || escrow.status === "delivered") ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-950">
          <span className="font-semibold">Poster locked {formatTsh(escrow.amountTsh)}.</span> You can work with confidence — funds
          are held until poster check (or auto-release). Keep chatting on this page, then upload preview + final when done.
        </p>
      ) : null}

      <ul className="text-dash-muted-foreground grid gap-1.5 text-xs leading-relaxed">
        <li>Money stays locked until confirm, auto-release, refund, or Honic dispute decision.</li>
        <li>Helper uploads a watermarked preview + final. Poster checks the preview only until release.</li>
        <li>
          Delivery window ~{ESCROW_DELIVERY_HOURS}h after lock; poster check ~{ESCROW_REVIEW_HOURS}h (then auto-release).
        </li>
        <li>Chat stays open while the job is active. Messages are cleared ~96h after the job finishes to save storage.</li>
      </ul>

      {escrow.isHelper && (escrow.status === "locked" || escrow.status === "delivered") ? (
        <HelperUploadZone
          escrowPublicId={escrow.publicId}
          hasPreview={Boolean(preview)}
          hasFinal={Boolean(finalFile)}
          revisionNote={escrow.status === "locked" ? escrow.revisionNote : null}
        />
      ) : null}

      {escrow.isHelper && !peerPayoutSaved && escrow.status !== "locked" && escrow.status !== "delivered" ? <PeerPayoutForm /> : null}

      {preview && (escrow.isPoster || escrow.isHelper) && ["delivered", "disputed", "released"].includes(escrow.status) ? (
        <SecurePreviewVault deliverablePublicId={preview.publicId} watermarkHint={`NEXIS·${escrow.publicId.slice(0, 8)}`} />
      ) : null}

      {escrow.isPoster && escrow.status === "delivered" ? (
        <PosterReviewActions escrowPublicId={escrow.publicId} revisionCount={escrow.revisionCount} />
      ) : null}

      {escrow.status === "released" && finalFile ? (
        <a href={`/api/portal/jobs/deliverable?id=${encodeURIComponent(finalFile.publicId)}`} className={PRIMARY}>
          Download final file
        </a>
      ) : null}

      {escrow.status === "disputed" ? (
        <p className="rounded-xl border border-dash-border bg-dash-muted/30 px-3 py-2 text-xs text-dash-muted-foreground">
          Dispute open{escrow.disputeReason ? `: ${escrow.disputeReason}` : "."} Honic reviews evidence before release or refund.
        </p>
      ) : null}

      {isStaff && escrow.status === "disputed" ? <StaffResolve escrowPublicId={escrow.publicId} /> : null}
    </section>
  );
}

function PeerHelpActivityTrack({
  steps,
}: {
  steps: ReturnType<typeof peerHelpActivitySteps>;
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {steps.map((step, i) => {
        const tone =
          step.state === "done"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900"
            : step.state === "current"
              ? "border-dash-accent/40 bg-dash-accent/10 text-dash-foreground"
              : step.state === "blocked"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-950"
                : "border-dash-border bg-dash-muted/20 text-dash-muted-foreground";
        return (
          <li key={step.key} className={`rounded-xl border px-2.5 py-2 ${tone}`}>
            <p className="text-[10px] font-semibold tracking-wide uppercase opacity-70">
              {i + 1}. {step.label}
            </p>
            <p className="mt-1 text-[11px] leading-snug">{step.detail}</p>
          </li>
        );
      })}
    </ol>
  );
}

function SharedActivityFeed({ events }: { events: PortalJobEscrowEvent[] }) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dash-border bg-dash-canvas/50 px-3 py-2.5">
        <p className="text-dash-foreground text-xs font-semibold">Shared activity</p>
        <p className="text-dash-muted-foreground mt-1 text-[11px]">
          Upload, poster check, release, and staff actions will appear here for both sides.
        </p>
      </div>
    );
  }
  const latest = events.slice(-8).reverse();
  return (
    <div className="rounded-xl border border-dash-border bg-dash-canvas/50 px-3 py-2.5">
      <p className="text-dash-foreground text-xs font-semibold">Shared activity</p>
      <ul className="mt-2 space-y-1.5">
        {latest.map((ev) => (
          <li key={ev.publicId} className="text-dash-muted-foreground flex gap-2 text-[11px] leading-snug">
            <span className="text-dash-foreground shrink-0 font-semibold tabular-nums">
              {new Date(ev.createdAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>
              <span className="text-dash-foreground capitalize">{ev.actorRole}</span> · {ev.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HelperUploadZone({
  escrowPublicId,
  hasPreview,
  hasFinal,
  revisionNote = null,
}: {
  escrowPublicId: string;
  hasPreview: boolean;
  hasFinal: boolean;
  revisionNote?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  function upload(kind: "preview" | "final", file: File | null) {
    if (!file) return;
    setStatus(null);
    startTransition(async () => {
      const urlRes = await portalEscrowUploadUrlAction({
        escrowPublicId,
        kind,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
      });
      if (!urlRes.ok || !urlRes.uploadUrl || !urlRes.storagePath) {
        setStatus({ ok: false, message: urlRes.message || "Could not start upload." });
        return;
      }
      const put = await fetch(urlRes.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        setStatus({ ok: false, message: "Upload failed. Try again." });
        return;
      }
      const digest = await sha256Hex(file);
      const reg = await portalEscrowRegisterUploadAction({
        escrowPublicId,
        kind,
        storagePath: urlRes.storagePath,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        originalName: file.name,
        contentSha256: digest,
      });
      setStatus(reg);
      if (reg.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-dash-border bg-dash-canvas/60 p-4">
      <p className="text-dash-foreground text-sm font-semibold">{revisionNote ? "Re-upload after fix request" : "Upload deliverables (helper)"}</p>
      <p className="text-dash-muted-foreground text-xs">
        Upload a clear <strong>preview image</strong> (JPG/PNG/WebP) for watermarked poster check, then the{" "}
        <strong>final file</strong>. Poster check opens only when both are in.
      </p>
      <label className="block text-xs font-semibold text-dash-muted-foreground">
        Preview image {hasPreview ? "· replaced ok" : "· required"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-1 block w-full text-sm"
          disabled={pending}
          onChange={(e) => upload("preview", e.target.files?.[0] ?? null)}
        />
      </label>
      <label className="block text-xs font-semibold text-dash-muted-foreground">
        Final file {hasFinal ? "· replaced ok" : "· required"}
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.zip,.pptx,.docx,application/pdf"
          className="mt-1 block w-full text-sm"
          disabled={pending}
          onChange={(e) => upload("final", e.target.files?.[0] ?? null)}
        />
      </label>
      {pending ? <p className="text-dash-muted-foreground text-xs">Uploading…</p> : null}
      {status ? (
        <p className={`text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>
          {status.ok ? status.message : toUserError(status.message ?? "")}
        </p>
      ) : null}
    </div>
  );
}

/** Shown to a helper right after they are picked: tell us where to pay you, then start. */
function PickedPayoutCard({
  amountTsh,
  savedPayout,
}: {
  amountTsh: number;
  savedPayout: { network: string; phoneTail: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [other, setOther] = useState(!savedPayout);

  return (
    <div className="space-y-3 rounded-xl border border-dash-border bg-dash-canvas/60 p-4">
      <div>
        <p className="text-dash-foreground text-sm font-bold">You were picked. Where should we pay you?</p>
        <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">
          {formatTsh(amountTsh)} is locked for you. Choose the number you will be paid on, then start the work.
        </p>
      </div>
      {savedPayout ? (
        <button
          type="button"
          className={`${PRIMARY} w-full`}
          disabled={pending}
          onClick={() => {
            setStatus(null);
            startTransition(async () => {
              const res = await portalUseSavedPayoutAction();
              setStatus(res);
              if (res.ok) router.refresh();
            });
          }}
        >
          {pending ? "Saving…" : `Use my saved number (${savedPayout.network} ···${savedPayout.phoneTail})`}
        </button>
      ) : null}
      {status ? (
        <p className={`text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>
          {status.ok ? status.message : toUserError(status.message ?? "")}
        </p>
      ) : null}
      {savedPayout && !other ? (
        <button type="button" onClick={() => setOther(true)} className="text-dash-muted-foreground text-xs font-semibold underline">
          Use a different number
        </button>
      ) : null}
      {other ? <PeerPayoutForm /> : null}
    </div>
  );
}

function PeerPayoutForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  return (
    <form
      className="space-y-2 rounded-xl border border-dash-border bg-dash-canvas/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setStatus(null);
        startTransition(async () => {
          const res = await portalSavePeerPayoutAction({
            network: String(fd.get("network") ?? ""),
            phone: String(fd.get("phone") ?? ""),
            accountName: String(fd.get("accountName") ?? ""),
          });
          setStatus(res);
          if (res.ok) router.refresh();
        });
      }}
    >
      <p className="text-dash-foreground text-sm font-semibold">Peer-help payout number</p>
      <p className="text-dash-muted-foreground text-xs">Required so released escrow can pay you. Name must match your profile.</p>
      <select name="network" required className={INPUT} defaultValue={PAYMENT_NETWORKS[0]}>
        {PAYMENT_NETWORKS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <input name="phone" required className={INPUT} placeholder="07XXXXXXXX" />
      <input name="accountName" required className={INPUT} placeholder="Account holder name (as registered)" />
      <button type="submit" className={PRIMARY} disabled={pending}>
        {pending ? "Saving…" : "Save payout number"}
      </button>
      {status ? (
        <p className={`text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>
          {status.ok ? status.message : toUserError(status.message ?? "")}
        </p>
      ) : null}
    </form>
  );
}

function PosterReviewActions({
  escrowPublicId,
  revisionCount,
}: {
  escrowPublicId: string;
  revisionCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [mode, setMode] = useState<"none" | "fix" | "dispute">("none");
  const canFix = revisionCount < ESCROW_MAX_REVISIONS;

  return (
    <div className="space-y-3 rounded-xl border border-dash-border bg-dash-canvas/60 p-4">
      <p className="text-dash-foreground text-sm font-semibold">Poster check</p>
      <p className="text-dash-muted-foreground text-xs">
        Review the watermarked preview. Release unlocks the final file and queues helper payout. Ask for a fix once or twice,
        or open a dispute for Honic to decide.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY}
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Confirm delivery and release escrow to the helper?")) return;
            setStatus(null);
            startTransition(async () => {
              const res = await portalEscrowConfirmAction(escrowPublicId);
              setStatus(res);
              if (res.ok) router.refresh();
            });
          }}
        >
          {pending ? "Saving…" : "Looks good — release"}
        </button>
        <button
          type="button"
          className={SOFT}
          disabled={pending || !canFix}
          onClick={() => setMode((m) => (m === "fix" ? "none" : "fix"))}
        >
          Needs fix ({revisionCount}/{ESCROW_MAX_REVISIONS})
        </button>
        <button type="button" className={SOFT} disabled={pending} onClick={() => setMode((m) => (m === "dispute" ? "none" : "dispute"))}>
          Open dispute
        </button>
      </div>
      {mode === "fix" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const note = String(new FormData(e.currentTarget).get("note") ?? "");
            setStatus(null);
            startTransition(async () => {
              const res = await portalEscrowRevisionAction(escrowPublicId, note);
              setStatus(res);
              if (res.ok) router.refresh();
            });
          }}
        >
          <textarea
            name="note"
            required
            minLength={12}
            rows={3}
            className={INPUT}
            placeholder="What should the helper change? They will re-upload preview + final."
          />
          <button type="submit" className={SOFT} disabled={pending}>
            Send fix request
          </button>
        </form>
      ) : null}
      {mode === "dispute" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
            setStatus(null);
            startTransition(async () => {
              const res = await portalEscrowDisputeAction(escrowPublicId, reason);
              setStatus(res);
              if (res.ok) router.refresh();
            });
          }}
        >
          <textarea
            name="reason"
            required
            minLength={20}
            rows={3}
            className={INPUT}
            placeholder="What is wrong with the delivery? Be specific (Honic reviews this)."
          />
          <button type="submit" className={SOFT} disabled={pending}>
            Submit dispute
          </button>
        </form>
      ) : null}
      {status ? (
        <p className={`text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>
          {status.ok ? status.message : toUserError(status.message ?? "")}
        </p>
      ) : null}
    </div>
  );
}

function StaffResolve({ escrowPublicId }: { escrowPublicId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<PortalResult | null>(null);

  return (
    <form
      className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const resolution = String(fd.get("resolution")) === "refund" ? "refund" : "release";
        setStatus(null);
        startTransition(async () => {
          const { portalEscrowResolveAction } = await import("@/app/portal/job-actions");
          const res = await portalEscrowResolveAction(escrowPublicId, resolution, String(fd.get("note") ?? ""));
          setStatus(res);
          if (res.ok) router.refresh();
        });
      }}
    >
      <p className="text-sm font-semibold text-dash-foreground">Staff resolve dispute</p>
      <select name="resolution" className={INPUT} defaultValue="release">
        <option value="release">Release to helper</option>
        <option value="refund">Refund poster</option>
      </select>
      <textarea name="note" required minLength={5} rows={2} className={INPUT} placeholder="Resolution note" />
      <button type="submit" className={PRIMARY} disabled={pending}>
        {pending ? "Saving…" : "Apply resolution"}
      </button>
      {status ? (
        <p className={`text-xs ${status.ok ? "text-emerald-700" : "text-red-600"}`}>
          {status.ok ? status.message : toUserError(status.message ?? "")}
        </p>
      ) : null}
    </form>
  );
}

/** Watermarked preview vault: no native download UI, blur on hide, block context menu. */
function SecurePreviewVault({
  deliverablePublicId,
  watermarkHint,
}: {
  deliverablePublicId: string;
  watermarkHint: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const tok = await portalEscrowPreviewTokenAction(deliverablePublicId);
    if (!tok.ok || !tok.token) {
      setError(tok.message || "Could not open preview.");
      return;
    }
    const res = await fetch(`/api/portal/jobs/preview?token=${encodeURIComponent(tok.token)}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(j?.message || "Preview failed.");
      return;
    }
    const blob = await res.blob();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setBlobUrl(url);
  }, [deliverablePublicId]);

  useEffect(() => {
    void load();
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [load]);

  useEffect(() => {
    function onVis() {
      setHidden(document.hidden);
    }
    function onKey(e: KeyboardEvent) {
      // Soft deterrence for print-screen / save shortcuts
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "S", "P"].includes(e.key)) {
        e.preventDefault();
      }
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-dash-foreground text-sm font-semibold">Secure preview</p>
        <button type="button" className={`${SOFT} !py-1.5 !text-xs`} onClick={() => void load()}>
          Refresh session
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{toUserError(error)}</p> : null}
      <div
        className="relative overflow-hidden rounded-xl border border-dash-border bg-black/80 select-none"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{ WebkitUserSelect: "none", userSelect: "none" }}
      >
        {blobUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={blobUrl}
            alt="Watermarked escrow preview"
            className={`max-h-[420px] w-full object-contain transition ${hidden ? "blur-xl opacity-40" : ""}`}
            draggable={false}
          />
        ) : (
          <div className="text-dash-muted-foreground flex h-48 items-center justify-center text-sm">Loading secure preview…</div>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-wrap content-center justify-center gap-8 overflow-hidden opacity-40"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -28deg,
              transparent,
              transparent 40px,
              rgba(255,255,255,0.06) 40px,
              rgba(255,255,255,0.06) 80px
            )`,
          }}
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="rotate-[-28deg] text-[11px] font-bold tracking-widest text-white/80">
              {watermarkHint} · PREVIEW ONLY · NO DOWNLOAD
            </span>
          ))}
        </div>
        {hidden ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center text-xs font-semibold text-white">
            Preview hidden while the tab is not focused
          </div>
        ) : null}
      </div>
      <p className="text-dash-muted-foreground text-[11px]">
        Right-click, save, and print shortcuts are blocked in-app. Screenshots may still be possible on the device — the
        watermark identifies this escrow if a leak is reported.
      </p>
    </div>
  );
}

export function EscrowFundFields({
  network,
  phone,
  onNetwork,
  onPhone,
}: {
  network: string;
  phone: string;
  onNetwork: (v: string) => void;
  onPhone: (v: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-dash-muted-foreground text-[11px]">
        Mobile money pays <strong>Honic escrow</strong> (held safely). Nobody is paid until you approve the work.
      </p>
      <select className={INPUT} value={network} onChange={(e) => onNetwork(e.target.value)}>
        {PAYMENT_NETWORKS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <input
        className={INPUT}
        value={phone}
        onChange={(e) => onPhone(e.target.value)}
        placeholder="07XXXXXXXX"
        inputMode="tel"
      />
    </div>
  );
}
