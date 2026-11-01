"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createRegisteredClientAction } from "@/app/clients/actions";

const INPUT =
  "border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2";

export function AddRegisteredClientForm() {
  const router = useRouter();
  const [status, setStatus] = useState<{ type: "ok" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setStatus(null);
        startTransition(async () => {
          try {
            await createRegisteredClientAction(String(fd.get("name") ?? ""), String(fd.get("phone") ?? ""));
            form.reset();
            setStatus({ type: "ok", message: "Client added." });
            router.refresh();
          } catch (err) {
            setStatus({ type: "error", message: err instanceof Error ? err.message : "Could not add client." });
          }
        });
      }}
      className="border-dash-border bg-dash-card mb-6 grid gap-3 rounded-2xl border p-4 shadow-sm sm:grid-cols-[1fr_220px_auto] sm:items-end"
    >
      <label>
        <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Client name *</span>
        <input name="name" required maxLength={200} className={INPUT} placeholder="e.g. DIT Electronics" />
      </label>
      <label>
        <span className="text-dash-muted-foreground mb-1 block text-xs font-semibold uppercase">Phone</span>
        <input name="phone" maxLength={40} className={INPUT} placeholder="Optional" />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="bg-dash-accent rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add client"}
      </button>
      {status ? (
        <p
          role="status"
          className={`sm:col-span-3 text-sm ${status.type === "ok" ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}
        >
          {status.message}
        </p>
      ) : null}
    </form>
  );
}
