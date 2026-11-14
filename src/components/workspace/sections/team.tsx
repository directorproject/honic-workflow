"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  cancelInviteAction,
  deleteWorkspaceAction,
  inviteMemberAction,
  removeMemberAction,
  setSupervisorLinkAction,
  updateWorkspaceAction,
} from "@/app/portal/workspace-actions";
import { PushToggle } from "@/components/workspace/push-toggle";
import { useRun, useWs } from "@/components/workspace/ws-context";
import { Badge, BTN, BTN_DANGER, BTN_GHOST, BTN_SOFT, INPUT, Label, Panel, Status } from "@/components/workspace/ws-ui";
import { formatDate } from "@/lib/workspace/dates";
import type { WorkspaceBundle } from "@/lib/workspace/types";

function shareOrigin(): string {
  return (process.env.NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
}

export function TeamSection({ bundle }: { bundle: WorkspaceBundle }) {
  const { workspaceId, viewer } = useWs();
  const router = useRouter();
  const ws = bundle.workspace;
  const me = bundle.members.find((m) => m.user_id === viewer.userId);
  const canManage = viewer.kind === "staff" || me?.role === "leader";
  const invite = useRun();
  const sup = useRun();
  const link = useRun();
  const danger = useRun();
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState("");
  const supervisorUrl = ws.supervisor_token ? `${shareOrigin()}/portal/s/${ws.supervisor_token}` : "";

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this link:", text);
    }
  }

  return (
    <>
      <Panel title="Team" subtitle="Everyone in the team shares this workspace. One project per account.">
        <ul className="divide-dash-border divide-y">
          {bundle.members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="bg-dash-accent/15 text-dash-accent flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold">
                {m.full_name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-dash-foreground text-sm font-semibold">
                  {m.full_name} {m.user_id === viewer.userId ? <span className="text-dash-muted-foreground font-normal">(you)</span> : null}
                </p>
                <p className="text-dash-muted-foreground text-xs">{[m.email, m.course, m.institution].filter(Boolean).join(" · ")}</p>
              </div>
              <Badge className={m.role === "leader" ? "bg-dash-accent/15 text-dash-accent" : "bg-dash-muted text-dash-muted-foreground"}>
                {m.role === "leader" ? "Leader" : "Member"}
              </Badge>
              {viewer.canEdit && (canManage || m.user_id === viewer.userId) && bundle.members.length > 1 ? (
                <button
                  type="button"
                  className={BTN_DANGER}
                  disabled={danger.pending}
                  onClick={() => {
                    const self = m.user_id === viewer.userId;
                    if (!window.confirm(self ? "Leave this team? You will lose access to this workspace." : `Remove ${m.full_name} from the team?`)) return;
                    danger.run(() => removeMemberAction(workspaceId, m.user_id), { onOk: () => self && router.push("/portal") });
                  }}
                >
                  {m.user_id === viewer.userId ? "Leave" : "Remove"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <Status status={danger.status} />

        {viewer.canEdit ? (
          <form
            className="border-dash-border mt-4 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              invite.run(() => inviteMemberAction(workspaceId, email), { onOk: () => setEmail("") });
            }}
          >
            <p className="text-dash-foreground mb-2 text-sm font-semibold">Invite a partner</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@email.com"
                className={`${INPUT} max-w-sm flex-1`}
              />
              <button type="submit" disabled={invite.pending} className={BTN}>
                {invite.pending ? "Inviting…" : "Send invitation"}
              </button>
            </div>
            <p className="text-dash-muted-foreground mt-1 text-xs">
              They create a portal account with that email and fill in their details, then open the link.
            </p>
            <div className="mt-2">
              <Status status={invite.status} />
            </div>
          </form>
        ) : null}

        {bundle.invites.length ? (
          <div className="mt-4">
            <p className="text-dash-muted-foreground mb-1 text-xs font-semibold uppercase">Waiting to join</p>
            <ul className="space-y-1.5">
              {bundle.invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-dash-foreground">{i.email}</span>
                  <span className="text-dash-muted-foreground text-xs">invited {formatDate(i.created_at)}</span>
                  {viewer.canEdit ? (
                    <>
                      <button type="button" className={BTN_GHOST} onClick={() => copy(`${shareOrigin()}/portal/join/${i.token}`, i.id)}>
                        {copied === i.id ? "Copied" : "Copy link"}
                      </button>
                      <button type="button" className={BTN_DANGER} onClick={() => invite.run(() => cancelInviteAction(workspaceId, i.id))}>
                        Cancel
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      <Panel title="Supervisor" subtitle="Your university supervisor's contacts and meeting times.">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            sup.run(() => updateWorkspaceAction(workspaceId, Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]))));
          }}
        >
          <Label text="Name">
            <input name="supervisor_name" maxLength={120} defaultValue={ws.supervisor_name ?? ""} className={INPUT} disabled={!viewer.canEdit} />
          </Label>
          <Label text="Phone">
            <input name="supervisor_phone" maxLength={40} defaultValue={ws.supervisor_phone ?? ""} className={INPUT} disabled={!viewer.canEdit} />
          </Label>
          <Label text="Email (same as their supervisor portal login)">
            <input name="supervisor_email" type="email" maxLength={254} defaultValue={ws.supervisor_email ?? ""} className={INPUT} disabled={!viewer.canEdit} />
          </Label>
          <Label text="Meeting days and times">
            <input
              name="supervisor_meetings"
              maxLength={200}
              placeholder="e.g. Tuesdays 10:00, office B12"
              defaultValue={ws.supervisor_meetings ?? ""}
              className={INPUT}
              disabled={!viewer.canEdit}
            />
          </Label>
          {viewer.canEdit ? (
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button type="submit" disabled={sup.pending} className={BTN}>
                {sup.pending ? "Saving…" : "Save supervisor"}
              </button>
              <Status status={sup.status} />
            </div>
          ) : null}
        </form>

        <div className="border-dash-border mt-5 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-dash-foreground text-sm font-semibold">Backup link (optional)</p>
              <p className="text-dash-muted-foreground text-xs">
                Prefer the supervisor portal at /supervisor with one account. This link still works without signing in.
                They only see review items you marked Shared.
              </p>
            </div>
            {viewer.canEdit ? (
              <button
                type="button"
                disabled={link.pending}
                className={ws.supervisor_link_enabled ? BTN_SOFT : BTN}
                onClick={() => link.run(() => setSupervisorLinkAction(workspaceId, !ws.supervisor_link_enabled))}
              >
                {ws.supervisor_link_enabled ? "Turn off" : "Turn on"}
              </button>
            ) : null}
          </div>
          {ws.supervisor_link_enabled && supervisorUrl ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input readOnly value={supervisorUrl} className={`${INPUT} flex-1 font-mono text-xs`} onFocus={(e) => e.target.select()} />
              <button type="button" className={BTN_SOFT} onClick={() => copy(supervisorUrl, "sup")}>
                {copied === "sup" ? "Copied" : "Copy"}
              </button>
              {viewer.canEdit ? (
                <button
                  type="button"
                  className={BTN_GHOST}
                  onClick={() => {
                    if (window.confirm("Make a new link? The old link will stop working.")) {
                      link.run(() => setSupervisorLinkAction(workspaceId, true, true));
                    }
                  }}
                >
                  New link
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="mt-2">
            <Status status={link.status} />
          </div>
        </div>
      </Panel>

      {viewer.kind === "student" ? (
        <Panel title="Notifications and app" subtitle="Get reminders before deadlines and alerts when Honic replies.">
          <PushToggle />
          <p className="text-dash-muted-foreground mt-3 text-xs">
            Install the portal as an app: on Android open the browser menu and choose Install app or Add to Home screen. On
            iPhone tap Share, then Add to Home Screen.
          </p>
        </Panel>
      ) : null}

      {viewer.canEdit && canManage ? (
        <Panel title="Delete workspace" subtitle="Removes the plan, documents, files, logbook and everything else for the whole team.">
          <button
            type="button"
            className="rounded-xl border border-red-500/40 px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-300"
            disabled={danger.pending}
            onClick={() => {
              const typed = window.prompt(`Type DELETE to remove "${ws.name}" and all its data.`);
              if (typed !== "DELETE") return;
              danger.run(() => deleteWorkspaceAction(workspaceId), { onOk: () => router.push(viewer.kind === "staff" ? "/students" : "/portal") });
            }}
          >
            Delete this workspace
          </button>
        </Panel>
      ) : null}
    </>
  );
}
