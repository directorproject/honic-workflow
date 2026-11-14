"use client";

import { useMemo, useRef, useState } from "react";

import { deleteItemAction, saveItemAction, setFileObtainedPlaceAction } from "@/app/portal/workspace-actions";
import { FIELD_CAPTURE_ACCEPT, FileUploadButton, useProjectFileUpload } from "@/components/workspace/file-upload";
import { fileUrl, useRun, useWs } from "@/components/workspace/ws-context";
import { BTN, BTN_DANGER, BTN_GHOST, Empty, INPUT, Label, Modal, Panel, Status } from "@/components/workspace/ws-ui";
import {
  FIELD_STUDY_FOLDER,
  FIELD_STUDY_LOCATION,
  folderForFieldCapture,
  formatBytes,
} from "@/lib/workspace/constants";
import { formatDate, relativeDays } from "@/lib/workspace/dates";
import type { CalendarEvent, FileItem, WorkspaceBundle } from "@/lib/workspace/types";

function isFieldVisit(event: CalendarEvent): boolean {
  return event.location === FIELD_STUDY_LOCATION || /field|site visit|on-?site/i.test(event.title);
}

function isImage(f: FileItem) {
  return Boolean(f.mime_type?.startsWith("image/")) || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(f.name);
}

function isVideo(f: FileItem) {
  return Boolean(f.mime_type?.startsWith("video/")) || /\.(mp4|mov|webm|mkv|avi)$/i.test(f.name);
}

function isAudio(f: FileItem) {
  return Boolean(f.mime_type?.startsWith("audio/")) || /\.(mp3|wav|m4a|aac|ogg)$/i.test(f.name);
}

export function FieldStudySection({ bundle, today }: { bundle: WorkspaceBundle; today: string }) {
  const { workspaceId, viewer } = useWs();
  const { run, pending, status } = useRun();
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);
  const visits = useMemo(
    () => bundle.events.filter(isFieldVisit).sort((a, b) => a.starts_on.localeCompare(b.starts_on)),
    [bundle.events],
  );
  const upcoming = visits.filter((v) => v.starts_on >= today);
  const past = visits.filter((v) => v.starts_on < today);

  const filesByVisit = useMemo(() => {
    const map = new Map<string, FileItem[]>();
    for (const f of bundle.files) {
      if (!f.event_id) continue;
      const list = map.get(f.event_id) ?? [];
      list.push(f);
      map.set(f.event_id, list);
    }
    return map;
  }, [bundle.files]);

  const looseCaptures = useMemo(() => {
    const visitIds = new Set(visits.map((v) => v.id));
    return bundle.files
      .filter((f) => {
        if ((f.folder?.trim() || "") !== FIELD_STUDY_FOLDER) return false;
        if (f.event_id && visitIds.has(f.event_id)) return false;
        return true;
      })
      .slice(0, 24);
  }, [bundle.files, visits]);

  return (
    <div className="space-y-4">
      <Panel
        title="On-site visit / field study"
        subtitle="Plan visits, record what you got on site, and tag where each file came from (e.g. Muhimbili Hospital)."
        actions={
          viewer.canEdit ? (
            <button
              type="button"
              className={BTN}
              onClick={() => setEditing({ starts_on: today, kind: "other", title: "", location: FIELD_STUDY_LOCATION })}
            >
              Add visit
            </button>
          ) : null
        }
      >
        <Status status={status} />
        {!visits.length ? (
          <Empty title="No field visits yet">
            Add a place and date, then after the visit write what you found and upload photos or video — they go into Project
            files automatically.
          </Empty>
        ) : (
          <div className="space-y-6">
            <VisitList
              label="Upcoming"
              items={upcoming}
              today={today}
              canEdit={viewer.canEdit}
              filesByVisit={filesByVisit}
              onEdit={setEditing}
              onDelete={(id) => run(() => deleteItemAction(workspaceId, "event", id))}
            />
            <VisitList
              label="Past visits"
              items={past}
              today={today}
              canEdit={viewer.canEdit}
              filesByVisit={filesByVisit}
              onEdit={setEditing}
              onDelete={(id) => run(() => deleteItemAction(workspaceId, "event", id))}
            />
          </div>
        )}
      </Panel>

      {viewer.canEdit ? (
        <Panel
          title="Quick capture"
          subtitle="Set the place first, then drop files. Images → Images, video → Videos, audio → Audios, other → Field study."
        >
          <FieldCaptureDropZone />
        </Panel>
      ) : null}

      {looseCaptures.length ? (
        <Panel title="Recent field media" subtitle="Also listed under Project files. Edit the place if needed.">
          <CaptureGrid files={looseCaptures} canEdit={viewer.canEdit} />
        </Panel>
      ) : null}

      {editing ? (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "Edit field visit" : "New field visit"}>
          <VisitEditForm
            editing={editing}
            today={today}
            pending={pending}
            captures={editing.id ? filesByVisit.get(editing.id) ?? [] : []}
            canEdit={viewer.canEdit}
            onClose={() => setEditing(null)}
            onSave={(v) =>
              run(() => saveItemAction(workspaceId, "event", editing.id ?? null, v), { onOk: () => setEditing(null) })
            }
          />
        </Modal>
      ) : null}
    </div>
  );
}

function VisitEditForm({
  editing,
  today,
  pending,
  captures,
  canEdit,
  onClose,
  onSave,
}: {
  editing: Partial<CalendarEvent>;
  today: string;
  pending: boolean;
  captures: FileItem[];
  canEdit: boolean;
  onClose: () => void;
  onSave: (v: Record<string, string>) => void;
}) {
  const [place, setPlace] = useState(editing.title?.trim() || "");

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = Object.fromEntries([...fd.entries()].map(([k, val]) => [k, String(val)]));
        v.kind = "other";
        v.location = FIELD_STUDY_LOCATION;
        onSave(v);
      }}
    >
      <Label text="Place or activity">
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={editing.title ?? ""}
          className={INPUT}
          autoFocus
          onChange={(e) => setPlace(e.target.value)}
          placeholder="e.g. Muhimbili Hospital"
        />
      </Label>
      <Label text="Date">
        <input name="starts_on" type="date" required defaultValue={editing.starts_on ?? today} className={INPUT} />
      </Label>
      <Label text="What I got from this visit">
        <textarea
          name="notes"
          rows={4}
          maxLength={2000}
          defaultValue={editing.notes ?? ""}
          className={INPUT}
          placeholder="Measurements, contacts, observations, problems on site, next steps…"
        />
      </Label>
      {editing.id && canEdit ? (
        <div className="border-dash-border space-y-2 border-t pt-3">
          <p className="text-dash-foreground text-xs font-semibold tracking-wide uppercase">Attach from the visit</p>
          <Label text="Where these files were obtained">
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              maxLength={160}
              className={INPUT}
              placeholder="e.g. Muhimbili Hospital"
            />
          </Label>
          <p className="text-dash-muted-foreground text-xs">
            Photos, video, audio, or documents — saved to Project files with this place, linked to this visit.
          </p>
          <FileUploadButton
            folder={FIELD_STUDY_FOLDER}
            eventId={editing.id}
            obtainedPlace={place.trim() || null}
            label="Add photos / video / files"
            soft
            accept={FIELD_CAPTURE_ACCEPT}
            resolveFolder={folderForFieldCapture}
          />
          {captures.length ? <CaptureGrid files={captures} canEdit={canEdit} /> : null}
        </div>
      ) : (
        <p className="text-dash-muted-foreground text-xs">
          Save the visit first, then you can attach photos and video and set where they were obtained.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={BTN}>
          {pending ? "Saving…" : "Save visit"}
        </button>
        <button type="button" className={BTN_GHOST} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function FieldCaptureDropZone() {
  const [place, setPlace] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { canEdit, busy, error, uploadFiles } = useProjectFileUpload({
    folder: FIELD_STUDY_FOLDER,
    resolveFolder: folderForFieldCapture,
  });
  const [over, setOver] = useState(false);
  if (!canEdit) return null;

  function startUpload(files: FileList | File[]) {
    const where = place.trim();
    if (!where) {
      window.alert("Enter where the file was obtained first (e.g. Muhimbili Hospital).");
      return;
    }
    void uploadFiles(files, where);
  }

  return (
    <div className="space-y-3">
      <Label text="Where obtained">
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          maxLength={160}
          className={INPUT}
          placeholder="e.g. Muhimbili Hospital"
        />
      </Label>
      <div
        className={`border-dash-border rounded-none border border-dashed px-4 py-6 transition ${
          over ? "border-dash-accent bg-dash-accent/5" : "bg-dash-card/40"
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files?.length) startUpload(e.dataTransfer.files);
        }}
      >
        <p className="text-dash-foreground text-sm font-semibold">
          {busy ? "Uploading…" : "Drop images, video, or files here"}
        </p>
        <p className="text-dash-muted-foreground mt-1 text-xs">
          Stored in Project files with the place above (25 MB max each).
        </p>
        <input
          ref={input}
          type="file"
          multiple
          accept={FIELD_CAPTURE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) startUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <button type="button" disabled={Boolean(busy)} className={`${BTN} mt-3`} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : "Choose files"}
        </button>
        {busy ? <p className="text-dash-muted-foreground mt-2 text-xs">{busy}</p> : null}
        {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}

function VisitList({
  label,
  items,
  today,
  canEdit,
  filesByVisit,
  onEdit,
  onDelete,
}: {
  label: string;
  items: CalendarEvent[];
  today: string;
  canEdit: boolean;
  filesByVisit: Map<string, FileItem[]>;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-dash-foreground text-sm font-semibold">{label}</h3>
      <ul className="divide-dash-border mt-2 divide-y">
        {items.map((visit) => {
          const captures = filesByVisit.get(visit.id) ?? [];
          return (
            <li key={visit.id} className="py-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-dash-foreground text-sm font-semibold">{visit.title}</p>
                  <p className="text-dash-muted-foreground mt-0.5 text-xs">
                    {formatDate(visit.starts_on)} · {relativeDays(visit.starts_on, today)}
                    {captures.length ? ` · ${captures.length} file${captures.length === 1 ? "" : "s"}` : ""}
                  </p>
                  {visit.notes ? (
                    <div className="mt-2">
                      <p className="text-dash-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                        From the visit
                      </p>
                      <p className="text-dash-foreground mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{visit.notes}</p>
                    </div>
                  ) : (
                    <p className="text-dash-muted-foreground mt-1 text-xs">No findings written yet.</p>
                  )}
                </div>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <FileUploadButton
                      folder={FIELD_STUDY_FOLDER}
                      eventId={visit.id}
                      obtainedPlace={visit.title.trim() || null}
                      label="Add media"
                      soft
                      accept={FIELD_CAPTURE_ACCEPT}
                      resolveFolder={folderForFieldCapture}
                    />
                    <button type="button" className={BTN_GHOST} onClick={() => onEdit(visit)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={BTN_DANGER}
                      onClick={() => window.confirm("Delete this visit?") && onDelete(visit.id)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
              {captures.length ? (
                <div className="mt-3">
                  <CaptureGrid files={captures} canEdit={canEdit} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CaptureGrid({ files, canEdit }: { files: FileItem[]; canEdit: boolean }) {
  const ctx = useWs();
  const { workspaceId } = ctx;
  const { run, pending } = useRun();

  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {files.map((f) => {
        const href = fileUrl(ctx, f.id);
        const openHref = fileUrl(ctx, f.id, true);
        const kind = isImage(f) ? "Image" : isVideo(f) ? "Video" : isAudio(f) ? "Audio" : "File";
        return (
          <li key={f.id} className="border-dash-border bg-dash-muted/20 flex items-start gap-2 rounded-none border px-2.5 py-2">
            {isImage(f) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={openHref} alt="" className="h-12 w-12 shrink-0 object-cover" />
            ) : (
              <span className="bg-dash-muted text-dash-muted-foreground inline-flex h-12 w-12 shrink-0 items-center justify-center text-[10px] font-semibold uppercase">
                {kind.slice(0, 3)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-dash-foreground truncate text-xs font-semibold" title={f.name}>
                {f.name}
              </p>
              <p className="text-dash-muted-foreground text-[11px]">
                {kind} · {f.folder} · {formatBytes(f.size_bytes)}
              </p>
              {f.obtained_place ? (
                <p className="text-dash-foreground mt-0.5 truncate text-[11px] font-medium" title={f.obtained_place}>
                  Obtained: {f.obtained_place}
                </p>
              ) : (
                <p className="text-dash-muted-foreground mt-0.5 text-[11px]">No place set</p>
              )}
              <div className="mt-1 flex flex-wrap gap-2">
                <a href={href} className="text-dash-accent text-[11px] font-semibold" target="_blank" rel="noreferrer">
                  Open
                </a>
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="text-dash-muted-foreground hover:text-dash-foreground text-[11px] font-semibold"
                    onClick={() => {
                      const next = window.prompt("Where was this file obtained?", f.obtained_place ?? "");
                      if (next === null) return;
                      void run(() => setFileObtainedPlaceAction(workspaceId, f.id, next));
                    }}
                  >
                    Set place
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
