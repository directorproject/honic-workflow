/** Build `/plans` URL with optional client filter and week offset (0 = current calendar week). */
export function buildPlansUrl(opts: { client?: string; week?: number }): string {
  const params = new URLSearchParams();
  if (opts.client?.trim()) params.set("client", opts.client.trim());
  if (opts.week !== undefined && opts.week !== 0) params.set("week", String(opts.week));
  const q = params.toString();
  return q ? `/plans?${q}` : "/plans";
}
