/**
 * Map internal / provider / database errors to short messages safe to show students.
 * Never surface env var names, stack traces, or raw provider payloads.
 */

const FRIENDLY_PAYMENT =
  "Payment could not be started right now. Check your number and try again in a moment, or contact Honic support.";

const FRIENDLY_GENERIC = "Something went wrong. Please try again in a moment.";
const FRIENDLY_RETRY = "Please try again. If the problem continues, contact Honic support.";
const FRIENDLY_CONNECTION = "It looks like there's a connection problem. Please check your internet and try again.";
const FRIENDLY_TIMEOUT = "The request took too long. Please try again.";

const ALLOWED_EXACT = new Set([
  // Authentication & Account
  "Fill in your details first.",
  "Please sign in again.",
  "This account cannot use the student portal.",
  "This account cannot join a student team.",
  "This account cannot use the supervisor portal. Use a supervisor account.",
  "The two passwords do not match.",
  "Enter a valid email address.",
  "Password must be at least 8 characters.",
  "Enter your name.",
  "Wrong email or password.",
  "Confirm your email first: open the link we sent you.",
  "Google sign-in is not available right now.",
  "Google sign-in failed. Try email instead.",

  // Payment & Transactions
  "Choose a payment network.",
  "Enter a valid Tanzanian mobile number.",
  "Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX).",
  "Choose the full year or one semester plan.",
  "Online payment is not enabled yet. Contact Honic to complete this payment.",
  "The minimum payment is TSh 500. Please enter a higher amount.",
  "Payment amount cannot exceed TSh 5,000,000.",
  "Your phone number is not valid. Please check and try again.",
  "Your payment network is not supported. Please choose another network.",

  // Jobs & Help
  "You can read peer requests for free. Post and offer help need an active Nexis Desk plan.",
  "Your message was sent. The other person will see it soon.",
  "Failed to send message. Check your connection and try again.",
  "You need an active Nexis Desk plan to post help requests.",
  "You need an active Nexis Desk plan to offer help.",

  // Validation
  "Service unavailable. Please try again later.",
  "Please wait a moment and try again.",
  "Something went wrong. Please refresh and try again.",

  // Titles & Projects
  "Choose a project title first.",
  "Select this title first.",
  "Title must be at least 8 characters.",
  "This title is already taken.",
  "You already own this title.",
]);

export function toUserError(raw: unknown, fallback = FRIENDLY_GENERIC): string {
  const message = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "";
  const text = String(message ?? "").trim();
  if (!text) return fallback;

  if (ALLOWED_EXACT.has(text)) return text;

  // Payment & Amount Validation - User Friendly
  if (/needs at least.*tsh|amount.*below|minimum.*tsh|at least.*tsh/i.test(text)) {
    const match = text.match(/(\d+)\s*tsh/i);
    if (match) {
      return `The minimum amount is TSh ${match[1]}. Please enter a higher amount.`;
    }
    return "The amount is too low. Please check the minimum requirement.";
  }

  if (/amount.*exceed|maximum.*tsh|too much|more than/i.test(text)) {
    const match = text.match(/(\d+)/);
    if (match) {
      return `The maximum amount is TSh ${match[1]}. Please enter a lower amount.`;
    }
    return "The amount is too high. Please enter a lower amount.";
  }

  if (/invalid.*phone|phone.*invalid|bad.*number|number.*invalid/i.test(text)) {
    return "Your phone number is not valid. Please check and try again (e.g., 0712345678).";
  }

  if (/network|provider|carrier/i.test(text)) {
    return "Your payment network is not supported. Please choose another network or contact support.";
  }

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
  if (/^Mobile money needs at least TSh /i.test(text)) return text;
  if (/^Amount must be at least /i.test(text)) return text;
  if (/^Escrow (amount|payment) /i.test(text)) return text;
  if (/^Check your phone/i.test(text)) return text;

  // Messaging errors
  if (/^Failed to send|could not send|send.*failed/i.test(text)) {
    return "Your message couldn't be sent. Check your connection and try again.";
  }

  // Connection & Network
  if (/connection|network|timeout|offline/i.test(text)) {
    return "It looks like there's a connection problem. Please check your internet and try again.";
  }

  // Session & Auth
  if (/session|expired|unauthorized|not signed in/i.test(text)) {
    return "Your session expired. Please sign in again.";
  }

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

// User-friendly validation error messages
export function validatePaymentAmount(amount: number, minAmount = 500, maxAmount = 5000000): string | null {
  if (!amount || amount < 1) {
    return `Please enter an amount of at least TSh ${minAmount}.`;
  }
  if (amount < minAmount) {
    return `The minimum payment is TSh ${minAmount}. Please enter a higher amount.`;
  }
  if (amount > maxAmount) {
    return `The maximum payment is TSh ${maxAmount.toLocaleString()}. Please enter a lower amount.`;
  }
  return null;
}

export function validatePhoneNumber(phone: string): string | null {
  if (!phone || phone.trim().length === 0) {
    return "Please enter your phone number.";
  }
  if (!/^(\+255|0)[67]\d{8}$/.test(phone.replace(/\s/g, ""))) {
    return "Please enter a valid Tanzanian mobile number (e.g., 0712345678 or +255712345678).";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) {
    return "Please enter your email address.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address.";
  }
  return null;
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value || value.trim().length === 0) {
    return `Please enter ${fieldName}.`;
  }
  return null;
}

export function validateMinLength(value: string, minLength: number, fieldName: string): string | null {
  if (value && value.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters.`;
  }
  return null;
}
