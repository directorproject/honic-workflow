"use client";

import { useActionState } from "react";

import {
  deleteRegisteredClientAction,
  type DeleteRegisteredClientState,
} from "@/app/registered-client-actions";

export function DeleteRegisteredClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const bound = deleteRegisteredClientAction.bind(null, clientId);
  const [state, formAction, pending] = useActionState<DeleteRegisteredClientState, FormData>(
    bound,
    null,
  );

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        title={
          state?.ok === false
            ? state.message
            : `Remove ${clientName} from registered clients (only if no tracked project uses it)`
        }
        className="text-dash-muted-foreground hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400 text-xs font-semibold transition-colors"
        onClick={(e) => {
          if (
            !window.confirm(
              `Remove "${clientName}" from registered clients? This only works if no tracked project uses this client.`,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        {pending ? "…" : "Delete"}
      </button>
      {state?.ok === false ? (
        <span className="sr-only" role="status">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
