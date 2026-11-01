export function tabHref(basePath: string, tab: string, extra = ""): string {
  const sep = basePath.includes("?") ? "&" : "?";
  return `${basePath}${sep}tab=${tab}${extra}`;
}

export function fileUrl(ctx: { fileBase: string; supervisorToken?: string }, id: string, inline = false): string {
  const q = new URLSearchParams();
  if (ctx.supervisorToken) q.set("t", ctx.supervisorToken);
  if (inline) q.set("inline", "1");
  const qs = q.toString();
  return `${ctx.fileBase}/${id}${qs ? `?${qs}` : ""}`;
}
