"use client";

import { useState } from "react";

import {
  clearTemporaryTitleBriefAction,
  rewriteTitleBriefFromPdfAction,
} from "@/app/portal/title-brief-actions";

/** Staff-only: delete temporary starter brief, then upload a PDF to rewrite sections. */
export function TitleBriefReplacePanel({ routeId }: { routeId: string }) {
  const [cleared, setCleared] = useState(false);

  return (
    <div className="border-dash-border bg-amber-500/10 mb-6 rounded-xl border px-4 py-4">
      <p className="text-dash-foreground text-sm font-semibold">Replace brief from PDF</p>
      <p className="text-dash-muted-foreground mt-1 text-xs leading-relaxed">
        Delete the temporary starter text first if needed, then upload the source PDF to rewrite problem statement and
        objectives from the real report.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <form
          action={async (fd) => {
            await clearTemporaryTitleBriefAction(fd);
            setCleared(true);
          }}
        >
          <input type="hidden" name="routeId" value={routeId} />
          <button
            type="submit"
            className="border-dash-border text-dash-foreground inline-flex items-center justify-center rounded-lg border bg-white px-3.5 py-2 text-sm font-semibold"
          >
            Delete temporary brief
          </button>
        </form>
        <form action={rewriteTitleBriefFromPdfAction} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="routeId" value={routeId} />
          <label className="min-w-0 flex-1 text-xs font-semibold">
            <span className="text-dash-muted-foreground">Upload PDF to rewrite</span>
            <input
              type="file"
              name="file"
              accept="application/pdf,.pdf"
              required
              className="border-dash-border text-dash-foreground mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
          <button
            type="submit"
            className="bg-dash-accent inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
          >
            {cleared ? "Upload & rewrite" : "Delete temp & rewrite from PDF"}
          </button>
        </form>
      </div>
    </div>
  );
}
