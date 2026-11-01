"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { portalUpdatePasswordAction, type PortalResult } from "@/app/portal/actions";
import { Card, Field, INPUT, PRIMARY, StatusText } from "@/components/portal/portal-ui";

export function PasswordResetForm() {
  const router = useRouter();
  const [status, setStatus] = useState<PortalResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card title="Set a new password" subtitle="Choose a password with at least 8 characters.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const p1 = String(fd.get("password") ?? "");
          if (p1 !== String(fd.get("password2") ?? "")) {
            setStatus({ ok: false, message: "The two passwords do not match." });
            return;
          }
          startTransition(async () => {
            const res = await portalUpdatePasswordAction(p1);
            setStatus(res);
            if (res.ok) setTimeout(() => router.push("/portal"), 1200);
          });
        }}
        className="grid gap-3"
      >
        <Field label="New password">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={INPUT} />
        </Field>
        <Field label="Confirm new password">
          <input name="password2" type="password" required minLength={8} autoComplete="new-password" className={INPUT} />
        </Field>
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Saving…" : "Save new password"}
        </button>
        <StatusText status={status} />
      </form>
    </Card>
  );
}
