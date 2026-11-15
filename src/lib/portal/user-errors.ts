/**
 * Map internal / provider / database errors to short messages safe to show students.
 * Never surface env var names, stack traces, or raw provider payloads.
 */

const FRIENDLY_PAYMENT =
  "Payment could not be started right now. Check your number and try again in a moment, or contact Honic support.";

const FRIENDLY_GENERIC = "Something went wrong. Please try again in a moment.";

const ALLOWED_EXACT = new Set([
  "Fill in your details first.",
  "Choose a payment network.",
  "Enter a valid Tanzanian mobile number.",
  "Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX).",
  "Choose the full year or one semester plan.",
  "Online payment is not enabled yet. Contact Honic to complete this payment.",
  "Please sign in again.",
  "Staff accounts cannot use the student portal.",
  "Service unavailable. Please try again later.",
  "The two passwords do not match.",
  "Enter a valid email address.",
  "Password must be at least 8 characters.",
  "Enter your name.",
  "Wrong email or password.",
  "Confirm your email first: open the link we sent you.",
  "Google sign-in is not available right now.",
  "Google sign-in failed. Try email instead.",
]);

export function toUserError(raw: unknown, fallback = FRIENDLY_GENERIC): string {
  const message = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "";
  const text = String(message ?? "").trim();
  if (!text) return fallback;

  if (ALLOWED_EXACT.has(text)) return text;

  // Known safe prefixes / patterns we intentionally show.
  if (/^Hide at least one title/i.test(text)) return text;
  if (/^Select this title first/i.test(text)) return text;
  if (/^You (already|still|do not|can )/i.test(text)) return text;
  if (/^A (payment|hide|membership) (prompt|payment) is already open/i.test(text)) return text;
  if (/^Accept the /i.test(text)) return text;
  if (/^Fill in /i.test(text)) return text;
  if (/^Choose /i.test(text)) return text;
  if (/^Type /i.test(text)) return text;
  if (/^Enter a /i.test(text) && !/SNIPPE|API_KEY|env|supabase|webhook/i.test(text)) return text;

  if (text === "PAYMENT_UNAVAILABLE" || /payment is temporarily unavailable/i.test(text)) {
    return FRIENDLY_PAYMENT;
  }

  // Payment / config / provider internals
  if (/snippe|SNIPPE_|API_KEY|WEBHOOK_SECRET|not configured|env\b|vercel|supabase|service role|stack|ECONNREFUSED|fetch failed|timeout|5\d\d|JWT|permission denied|row-level security|schema cache|does not exist/i.test(text)) {
    return /pay|snippe|mobile money|ussd|collection|webhook|PAYMENT_UNAVAILABLE/i.test(text) ? FRIENDLY_PAYMENT : FRIENDLY_GENERIC;
  }

  // Postgres / PostgREST noise
  if (/^[A-Z0-9_]{5,}:/.test(text) || /PGRST|postgrest|violates|duplicate key|foreign key/i.test(text)) {
    return FRIENDLY_GENERIC;
  }

  // Long technical blobs
  if (text.length > 160 || /[{}=<>]|https?:\/\/|\.ts\b|\.js\b|at\s+\S+\s+\(/.test(text)) {
    return /pay|amount|phone|mobile/i.test(text) ? FRIENDLY_PAYMENT : FRIENDLY_GENERIC;
  }

  return text;
}

export function paymentUnavailableMessage(): string {
  return "Mobile money payment is temporarily unavailable. Please try again later or contact Honic support.";
}
