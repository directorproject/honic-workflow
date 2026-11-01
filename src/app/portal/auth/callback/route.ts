import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "invite", "magiclink", "email_change"]);

/**
 * Email confirmation and password-reset links land here on the share host.
 * token_hash links (from the custom email templates) work on any device; ?code= links need the
 * browser that started the flow and remain supported as a fallback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/portal";
  let next = nextRaw.startsWith("/portal") ? nextRaw : "/portal";

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return NextResponse.redirect(`${origin}/portal?auth_error=${encodeURIComponent(error.message)}`);
    if (type === "recovery") next = "/portal/reset";
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Link opened in a different browser than the one that started the flow. Supabase has already
      // confirmed the email at this point; a password reset must be reopened on the original device.
      if (/code verifier/i.test(error.message)) {
        const notice = next === "/portal/reset" ? "reset_other_device" : "confirmed";
        return NextResponse.redirect(`${origin}/portal?notice=${notice}`);
      }
      return NextResponse.redirect(`${origin}/portal?auth_error=${encodeURIComponent(error.message)}`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/portal?auth_error=missing_code`);
}
