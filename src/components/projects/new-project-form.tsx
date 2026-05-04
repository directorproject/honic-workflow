"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { createTrackedProject } from "@/app/projects/actions";
import { ProjectDriveFolderFields } from "@/components/projects/project-drive-folder-fields";
import type { RegisteredClientRow } from "@/lib/dashboard-types";
import { PROJECT_TYPES } from "@/lib/project-types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-dash-accent hover:bg-dash-accent-dim disabled:opacity-60 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors"
    >
      {pending ? "Creating…" : "Create project"}
    </button>
  );
}

export function NewProjectForm({
  clients,
  initialClientId = "",
  children,
}: {
  clients: RegisteredClientRow[];
  initialClientId?: string;
  /** Render `<ProjectTimelineCard />` from a Server Component parent so intro text does not hydrate separately. */
  children?: ReactNode;
}) {
  const defaultClient =
    initialClientId && clients.some((c) => c.id === initialClientId) ? initialClientId : "";
  const initialRow = defaultClient ? clients.find((c) => c.id === defaultClient) : undefined;

  const [clientId, setClientId] = useState(defaultClient);
  const [clientName, setClientName] = useState(initialRow?.name ?? "");
  const [clientPhone, setClientPhone] = useState(initialRow?.phone ?? "");
  const [clientShareSubdomain, setClientShareSubdomain] = useState(initialRow?.shareSubdomain ?? "");

  useEffect(() => {
    const row = clients.find((c) => c.id === clientId);
    if (row) {
      setClientName(row.name);
      setClientPhone(row.phone ?? "");
      setClientShareSubdomain(row.shareSubdomain ?? "");
    } else {
      setClientName("");
      setClientPhone("");
      setClientShareSubdomain("");
    }
  }, [clientId]);

  return (
    <form action={createTrackedProject} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="min-w-0">{children}</div>

        <section
          className="border-dash-border bg-dash-card flex min-h-0 min-w-0 flex-col rounded-2xl border p-5 shadow-sm"
          aria-labelledby="registered-client-heading"
        >
          <h3 id="registered-client-heading" className="text-dash-foreground mb-4 text-sm font-semibold">
            Registered client
          </h3>
          <div className="space-y-5">
            <div>
              <label
                htmlFor="registered_client_id"
                className="text-dash-muted-foreground mb-1 block text-sm font-medium"
              >
                Client
              </label>
              <select
                id="registered_client_id"
                name="registered_client_id"
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
              >
                <option value="" disabled>
                  Select a client…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-dash-muted-foreground mt-2 text-xs leading-relaxed">
                After you pick a client, you can edit their title, phone, and share label below. Those values are saved
                on the client record when you create the project.
              </p>
            </div>

            <div>
              <label htmlFor="registered_client_name" className="text-dash-muted-foreground mb-1 block text-sm font-medium">
                Client title <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                id="registered_client_name"
                name="registered_client_name"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                autoComplete="organization"
                className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="registered_client_phone" className="text-dash-muted-foreground mb-1 block text-sm font-medium">
                  Phone <span className="font-normal opacity-70">(optional)</span>
                </label>
                <input
                  id="registered_client_phone"
                  name="registered_client_phone"
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="e.g. +1 234 567 8900"
                  className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                />
              </div>
              <div>
                <label
                  htmlFor="registered_client_share_subdomain"
                  className="text-dash-muted-foreground mb-1 block text-sm font-medium"
                >
                  Share subdomain label <span className="font-normal opacity-70">(optional)</span>
                </label>
                <input
                  id="registered_client_share_subdomain"
                  name="registered_client_share_subdomain"
                  value={clientShareSubdomain}
                  onChange={(e) => setClientShareSubdomain(e.target.value.toLowerCase())}
                  autoComplete="off"
                  placeholder="e.g. acme-api"
                  className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 font-mono text-sm outline-none focus:ring-2"
                />
              </div>
            </div>

            <div>
              <label htmlFor="title" className="text-dash-muted-foreground mb-1 block text-sm font-medium">
                Project title
              </label>
              <input
                id="title"
                name="title"
                required
                placeholder="e.g. Motor driver PCB — rev B"
                className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="project_type" className="text-dash-muted-foreground mb-1 block text-sm font-medium">
                  Type
                </label>
                <select
                  id="project_type"
                  name="project_type"
                  defaultValue="product_prototype"
                  className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                >
                  {PROJECT_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="priority" className="text-dash-muted-foreground mb-1 block text-sm font-medium">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue="medium"
                  className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="description" className="text-dash-muted-foreground mb-1 block text-sm font-medium">
                Description <span className="font-normal opacity-70">(optional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                placeholder="Goals, scope, hardware notes…"
                className="border-dash-border bg-dash-muted/30 text-dash-foreground focus:ring-dash-accent/25 w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </div>

            <ProjectDriveFolderFields variant="create-project" />
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}
