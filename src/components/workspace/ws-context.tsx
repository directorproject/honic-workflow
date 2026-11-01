"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";

import type { ActionResult } from "@/app/portal/workspace-actions";
import type { Member, Viewer } from "@/lib/workspace/types";

type WsContext = {
  workspaceId: string;
  viewer: Viewer;
  basePath: string;
  members: Member[];
  /** Download route prefix, e.g. /api/portal/files; the file id is appended. */
  fileBase: string;
  /** Set on the supervisor's read-only link (used for downloads and comments). */
  supervisorToken?: string;
};

export { fileUrl, tabHref } from "@/lib/workspace/links";

const Ctx = createContext<WsContext | null>(null);

export function WorkspaceProvider({ value, children }: { value: WsContext; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWs(): WsContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWs outside WorkspaceProvider");
  return v;
}

export type RunStatus = { ok: boolean; message: string } | null;

/** Runs a server action, shows its message and refreshes server data on success. */
export function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<RunStatus>(null);

  function run<T>(fn: () => Promise<ActionResult<T>>, opts: { ok?: string; onOk?: (data: T | undefined) => void } = {}) {
    setStatus(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        const message = res.message ?? opts.ok;
        if (message) setStatus({ ok: true, message });
        opts.onOk?.(res.data);
        router.refresh();
      } else {
        setStatus({ ok: false, message: res.message });
      }
    });
  }

  return { run, pending, status, setStatus };
}
