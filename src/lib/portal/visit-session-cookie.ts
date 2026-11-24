import { cookies } from "next/headers";

export const VISIT_SESSION_COOKIE = "honic_visit_sid";

/** Browser tab session id from client tracker (for server-side visit dedup). */
export async function visitSessionKeyFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(VISIT_SESSION_COOKIE)?.value;
  const key = String(raw ?? "").trim().slice(0, 80);
  return key.length >= 8 ? key : null;
}