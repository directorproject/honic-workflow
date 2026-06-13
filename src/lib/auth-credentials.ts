/** Login username → Supabase Auth email (email/password provider). */
export const AUTH_OPERATOR_USERNAME = "inova";
/** Default password for first-time operator (change after login in Supabase if needed). */
export const AUTH_OPERATOR_DEFAULT_PASSWORD = "hapinova";
export const AUTH_OPERATOR_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN?.trim() || "inova.local";

export function usernameToAuthEmail(username: string): string {
  const raw = username.trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  return `${raw}@${AUTH_OPERATOR_EMAIL_DOMAIN}`;
}

export function defaultOperatorEmail(): string {
  return usernameToAuthEmail(AUTH_OPERATOR_USERNAME);
}
