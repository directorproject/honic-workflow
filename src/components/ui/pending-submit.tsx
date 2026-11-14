"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Spinner } from "@/components/ui/spinner";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  idleLabel: ReactNode;
  pendingLabel?: ReactNode;
};

/** Drop-in submit button with spinner + wait cursor while a server action runs. */
export function PendingSubmit({
  idleLabel,
  pendingLabel = "Please wait…",
  className = "",
  disabled,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  const busy = pending || Boolean(disabled);
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 disabled:cursor-wait ${className}`}
      {...rest}
    >
      {busy ? <Spinner /> : null}
      {busy ? pendingLabel : idleLabel}
    </button>
  );
}
