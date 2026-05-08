import { normalizeShareResearchLinks } from "@/lib/share-client-references";

export function ShareClientReferencesCard({
  notes,
  linksRaw,
  sectionId = "share-references",
}: {
  notes: string | null | undefined;
  linksRaw: unknown;
  sectionId?: string;
}) {
  const links = normalizeShareResearchLinks(linksRaw);

  return (
    <section
      id={sectionId}
      className="border-dash-border bg-dash-card mb-10 scroll-mt-28 rounded-3xl border p-5 shadow-sm sm:p-6 sm:shadow-md"
      aria-labelledby="share-refs-public-heading"
    >
      <h2 id="share-refs-public-heading" className="text-dash-foreground mb-1 text-lg font-bold tracking-tight sm:text-xl">
        Reference materials from our research
      </h2>
      <p className="text-dash-muted-foreground mb-5 max-w-3xl text-sm leading-relaxed sm:text-base">
        Below are documents and links we distilled during source-find for this project. We hope they help you find
        stronger references and data for your own documentation.
      </p>

      {notes?.trim() ? (
        <div className="border-dash-border bg-dash-muted/20 mb-5 max-w-3xl rounded-xl border px-4 py-3">
          <p className="text-dash-foreground text-sm leading-relaxed whitespace-pre-wrap">{notes.trim()}</p>
        </div>
      ) : null}

      {links.length > 0 ? (
        <ul className="flex max-w-3xl flex-col gap-2">
          {links.map((link, i) => (
            <li key={`${link.url}-${i}`}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-dash-accent hover:text-dash-accent-dim text-sm font-semibold underline-offset-2 hover:underline"
              >
                {link.label}
              </a>
              <span className="text-dash-muted-foreground mt-0.5 block truncate text-xs">{link.url}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
