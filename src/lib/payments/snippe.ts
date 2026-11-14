import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const API_URL = (process.env.SNIPPE_API_URL || "https://api.snippe.sh").replace(/\/$/, "");
const MAX_WEBHOOK_BYTES = 64 * 1024;
const WEBHOOK_MAX_AGE_SEC = 300;
const WEBHOOK_MAX_FUTURE_SEC = 60;

function apiKey() {
  return process.env.SNIPPE_API_KEY?.trim() || "";
}

function webhookSecret() {
  return process.env.SNIPPE_WEBHOOK_SECRET?.trim() || "";
}

/** Live Snippe requires API key + webhook signing secret (no unsigned callbacks). */
export function snippeConfigured(): boolean {
  return Boolean(apiKey() && webhookSecret());
}

export function snippeWebhookSecretConfigured(): boolean {
  return Boolean(webhookSecret());
}

/** Normalize TZ mobile numbers to 255XXXXXXXXX (no plus). */
export function toSnippePhone(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (/^255\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `255${digits.slice(1)}`;
  if (/^[67]\d{8}$/.test(digits)) return `255${digits}`;
  return null;
}

/** Cryptographically strong idempotency key (Snippe max 30 chars). */
export function makeIdempotencyKey(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^A-Za-z0-9]/g, "").slice(0, 6) || "PAY";
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `${cleanPrefix}${stamp}${rand}`.slice(0, 30);
}

export type SnippePaymentResult = {
  reference: string;
  status: string;
  amount?: number;
  currency?: string;
  expiresAt?: string;
};

export type SnippePaymentSnapshot = {
  reference: string;
  status: string;
  amount: number | null;
  currency: string | null;
  orderId: string | null;
};

function assertSecureWebhookUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Webhook URL is invalid.");
  }
  const allowHttp = process.env.SNIPPE_ALLOW_HTTP_WEBHOOK === "true" && process.env.NODE_ENV !== "production";
  if (parsed.protocol === "https:") return;
  if (allowHttp && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) return;
  throw new Error("Webhook URL must be HTTPS (set SNIPPE_ALLOW_HTTP_WEBHOOK=true only for local http).");
}

export async function createMobilePayment(input: {
  amountTsh: number;
  phoneNumber: string;
  customer: { firstname: string; lastname: string; email: string };
  orderId: string;
  webhookUrl: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}): Promise<SnippePaymentResult> {
  if (!snippeConfigured()) {
    throw new Error("Snippe is not configured. Add SNIPPE_API_KEY and SNIPPE_WEBHOOK_SECRET.");
  }
  assertSecureWebhookUrl(input.webhookUrl);
  const phone = toSnippePhone(input.phoneNumber);
  if (!phone) throw new Error("Enter a valid Tanzanian mobile number (e.g. 07XX XXX XXX).");
  const amount = Math.round(Number(input.amountTsh));
  if (!Number.isFinite(amount) || amount < 500) throw new Error("Amount must be at least 500 TZS.");
  if (amount > 50_000_000) throw new Error("Amount exceeds the allowed maximum.");

  const body = {
    payment_type: "mobile",
    details: { amount, currency: "TZS" },
    phone_number: phone,
    customer: {
      firstname: input.customer.firstname.slice(0, 80) || "Student",
      lastname: input.customer.lastname.slice(0, 80) || "Portal",
      email: input.customer.email.slice(0, 120) || "student@honiccompany.com",
    },
    webhook_url: input.webhookUrl,
    metadata: {
      order_id: input.orderId,
      ...(input.metadata ?? {}),
    },
  };

  const res = await fetch(`${API_URL}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey.slice(0, 30),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    data?: {
      reference?: string;
      status?: string;
      amount?: { value?: number; currency?: string } | number;
      expires_at?: string;
    };
  };
  if (!res.ok || json.status === "error" || !json.data?.reference) {
    throw new Error(json.message || `Snippe payment failed (${res.status}).`);
  }
  const amountValue =
    typeof json.data.amount === "number"
      ? json.data.amount
      : typeof json.data.amount?.value === "number"
        ? json.data.amount.value
        : undefined;
  if (amountValue != null && amountValue !== amount) {
    throw new Error("Provider returned a different amount than requested. Payment aborted.");
  }
  return {
    reference: String(json.data.reference),
    status: String(json.data.status ?? "pending"),
    amount: amountValue,
    currency: typeof json.data.amount === "object" ? json.data.amount?.currency : "TZS",
    expiresAt: json.data.expires_at,
  };
}

/** Server-side confirmation against Snippe before fulfilling entitlements. */
export async function fetchSnippePayment(reference: string): Promise<SnippePaymentSnapshot | null> {
  if (!apiKey() || !reference) return null;
  const res = await fetch(`${API_URL}/v1/payments/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => ({}))) as {
    data?: {
      reference?: string;
      status?: string;
      amount?: { value?: number; currency?: string };
      metadata?: { order_id?: string };
    };
  };
  const data = json.data;
  if (!data?.reference) return null;
  return {
    reference: String(data.reference),
    status: String(data.status ?? "").toLowerCase(),
    amount: typeof data.amount?.value === "number" ? data.amount.value : null,
    currency: data.amount?.currency ? String(data.amount.currency).toUpperCase() : null,
    orderId: data.metadata?.order_id ? String(data.metadata.order_id) : null,
  };
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export type WebhookVerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_secret" | "missing_headers" | "stale" | "bad_signature" | "too_large" };

/** Verify Snippe webhook: required HMAC, replay window, constant-time compare. Never skips when secret missing. */
export function verifySnippeWebhook(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
): WebhookVerifyResult {
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  const secret = webhookSecret();
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (!timestamp || !signature) return { ok: false, reason: "missing_headers" };
  if (!/^\d{10,12}$/.test(timestamp)) return { ok: false, reason: "stale" };
  if (!/^[a-f0-9]{64}$/i.test(signature)) return { ok: false, reason: "bad_signature" };

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || age > WEBHOOK_MAX_AGE_SEC || age < -WEBHOOK_MAX_FUTURE_SEC) {
    return { ok: false, reason: "stale" };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (!safeEqualHex(expected, signature.toLowerCase())) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}

/** Amounts must match exactly (integer TZS). */
export function amountsMatch(expectedTsh: number, paidValue: unknown): boolean {
  const paid = Math.round(Number(paidValue));
  const expected = Math.round(Number(expectedTsh));
  return Number.isFinite(paid) && Number.isFinite(expected) && paid === expected && paid > 0;
}

export function publicWebhookUrl(): string {
  const base = (process.env.SNIPPE_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("SNIPPE_WEBHOOK_BASE_URL or NEXT_PUBLIC_APP_URL is required for Snippe webhooks.");
  const url = `${base}/api/payments/snippe/webhook`;
  assertSecureWebhookUrl(url);
  return url;
}
