"use client";

import { useState } from "react";

import { requestBookingAction, updateBookingAction } from "@/app/portal/workspace-actions";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN, BTN_DANGER, BTN_SOFT, Empty, INPUT, Label, Panel, Status } from "@/components/workspace/ws-ui";
import { BOOKING_KINDS, BOOKING_STATUSES, labelOf, tone } from "@/lib/workspace/constants";
import { formatDateTime } from "@/lib/workspace/dates";
import type { Booking } from "@/lib/workspace/types";

function localInput(iso: string): string {
  const d = new Date(iso);
  const eat = new Date(d.getTime() + 3 * 3600_000);
  return eat.toISOString().slice(0, 16);
}

function fromLocalInput(v: string): string {
  return v ? new Date(`${v}:00+03:00`).toISOString() : "";
}

export function SessionsSection({ bookings }: { bookings: Booking[] }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const upcoming = bookings.filter((b) => ["requested", "confirmed"].includes(b.status));
  const past = bookings.filter((b) => !["requested", "confirmed"].includes(b.status));

  return (
    <>
      {viewer.canEdit ? (
        <Panel
          title={viewer.kind === "staff" ? "Book a session for the team" : "Request a session with Honic"}
          subtitle={viewer.kind === "staff" ? "Staff bookings are confirmed straight away." : "Choose a time that suits you. Honic confirms or suggests another time."}
        >
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(
                () =>
                  requestBookingAction(workspaceId, {
                    kind: String(fd.get("kind")),
                    topic: String(fd.get("topic")),
                    preferredAt: fromLocalInput(String(fd.get("when"))),
                    durationMin: Number(fd.get("duration")),
                  }),
                { onOk: () => (e.target as HTMLFormElement).reset() },
              );
            }}
          >
            <Label text="What do you need?" wide>
              <input name="topic" required maxLength={200} placeholder="e.g. Help with the LoRa range test" className={INPUT} />
            </Label>
            <Label text="Type">
              <select name="kind" className={INPUT}>
                {BOOKING_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="Length">
              <select name="duration" defaultValue="60" className={INPUT}>
                {[30, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="Preferred time (East Africa Time)" wide>
              <input name="when" type="datetime-local" required className={INPUT} />
            </Label>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button type="submit" disabled={pending} className={BTN}>
                {pending ? "Sending…" : viewer.kind === "staff" ? "Book session" : "Send request"}
              </button>
              <Status status={status} />
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel title="Upcoming sessions">
        {upcoming.length ? <BookingList list={upcoming} /> : <Empty title="No upcoming sessions" />}
      </Panel>
      {past.length ? (
        <Panel title="Past and cancelled">
          <BookingList list={past} />
        </Panel>
      ) : null}
    </>
  );
}

function BookingList({ list }: { list: Booking[] }) {
  return (
    <ul className="space-y-3">
      {list.map((b) => (
        <BookingRow key={b.id} booking={b} />
      ))}
    </ul>
  );
}

function BookingRow({ booking: b }: { booking: Booking }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const [when, setWhen] = useState(localInput(b.confirmed_at ?? b.preferred_at));
  const [note, setNote] = useState(b.staff_note ?? "");
  const st = tone(BOOKING_STATUSES, b.status);

  return (
    <li className="border-dash-border rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-dash-foreground text-sm font-semibold">{b.topic}</p>
        <Badge className={st.tone}>{st.label}</Badge>
        <span className="text-dash-muted-foreground text-xs">
          {labelOf(BOOKING_KINDS, b.kind)} · {b.duration_min} min · asked by {b.requested_by_name ?? "student"}
        </span>
      </div>
      <p className="text-dash-muted-foreground mt-1 text-sm">
        {b.status === "confirmed" ? `Confirmed for ${formatDateTime(b.confirmed_at)}` : `Preferred: ${formatDateTime(b.preferred_at)}`}
      </p>
      {b.staff_note ? <p className="text-dash-foreground mt-1 text-sm">Honic: {b.staff_note}</p> : null}

      {viewer.kind === "staff" && ["requested", "confirmed"].includes(b.status) ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[14rem_1fr]">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={INPUT} aria-label="Confirmed time" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the students (room, what to bring)" className={INPUT} maxLength={1000} />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={pending}
              className={BTN}
              onClick={() => run(() => updateBookingAction(workspaceId, b.id, { status: "confirmed", confirmedAt: fromLocalInput(when), note }))}
            >
              {b.status === "confirmed" ? "Update time" : "Confirm"}
            </button>
            {b.status === "requested" ? (
              <button type="button" disabled={pending} className={BTN_SOFT} onClick={() => run(() => updateBookingAction(workspaceId, b.id, { status: "declined", note }))}>
                Decline
              </button>
            ) : (
              <button type="button" disabled={pending} className={BTN_SOFT} onClick={() => run(() => updateBookingAction(workspaceId, b.id, { status: "done", note }))}>
                Mark done
              </button>
            )}
          </div>
        </div>
      ) : null}
      {viewer.kind === "student" && ["requested", "confirmed"].includes(b.status) ? (
        <button
          type="button"
          className={`${BTN_DANGER} mt-2`}
          disabled={pending}
          onClick={() => window.confirm("Cancel this session?") && run(() => updateBookingAction(workspaceId, b.id, { status: "cancelled" }))}
        >
          Cancel session
        </button>
      ) : null}
      <Status status={status} />
    </li>
  );
}
