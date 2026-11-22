import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { isStaffUser } from "@/lib/auth-staff";
import { productGuidePending, withProductGuidePending } from "@/lib/portal/product-guide";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient, getSupabaseServiceRoleClient } from "@/lib/supabase-server";

async function rejectStaffOnPortal(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, origin: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && isStaffUser(user)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/portal?auth=signin&notice=student_only`);
  }
  return null;
}

async function provisionAfterGoogle(opts: {
  userId: string;
  email: string | undefined;
  fullName: string;
  role: "student" | "supervisor";
}) {
  try {
    if (opts.role === "supervisor") {
      const db = getSupabaseAdminClient();
      if (!db) return;
      await db.from("portal_supervisor_profiles").upsert(
        {
          user_id: opts.userId,
          email: (opts.email ?? "").toLowerCase(),
          full_name: opts.fullName || "Supervisor",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      return;
    }
    const { ensurePortalAccount } = await import("@/lib/portal/accounts");
    const admin = getSupabaseServiceRoleClient();
    if (admin) {
      await ensurePortalAccount(admin, opts.userId);
      const [{ data: account }, { data: profile }] = await Promise.all([
        admin.auth.admin.getUserById(opts.userId),
        admin.from("student_profiles").select("user_id").eq("user_id", opts.userId).maybeSingle(),
      ]);
      const meta = (account.user?.user_metadata ?? {}) as Record<string, unknown>;
      const guide = meta.portal_product_guide;
      // Brand-new students (no profile yet) must take the product tour.
      if (!profile && guide !== "done" && guide !== "pending") {
        await admin.auth.admin.updateUserById(opts.userId, {
          user_metadata: withProductGuidePending(meta),
        });
      }
    }
  } catch {
    /* profile rows can be created later */
  }
}

const OTP_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "invite", "magiclink", "email_change"]);

/**
 * Email confirmation, password-reset, and Google OAuth land here.
 * token_hash links (from the custom email templates) work on any device; ?code= links need the
 * browser that started the flow and remain supported as a fallback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const roleParam = searchParams.get("role") === "supervisor" ? "supervisor" : "student";
  const nextRaw = searchParams.get("next") ?? (roleParam === "supervisor" ? "/supervisor" : "/portal");
  let next =
    nextRaw.startsWith("/portal") || nextRaw.startsWith("/supervisor") ? nextRaw : "/portal";

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return NextResponse.redirect(`${origin}/portal?auth_error=${encodeURIComponent(error.message)}`);
    const staffBlock = await rejectStaffOnPortal(supabase, origin);
    if (staffBlock) return staffBlock;
    if (type === "recovery") next = "/portal/reset";
    if (type === "signup" && (next === "/portal" || next === "/portal/home" || next === "/portal/packs")) {
      next = "/portal/packs?guide=1";
    }
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
    const staffBlock = await rejectStaffOnPortal(supabase, origin);
    if (staffBlock) return staffBlock;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; role?: string };
      const role =
        roleParam === "supervisor" || next.startsWith("/supervisor") || meta.role === "supervisor"
          ? "supervisor"
          : "student";
      const fullName = String(meta.full_name || meta.name || "").trim() || (role === "supervisor" ? "Supervisor" : "Student");
      if (role === "supervisor" && meta.role !== "supervisor") {
        await supabase.auth.updateUser({ data: { role: "supervisor", full_name: fullName } });
      }
      await provisionAfterGoogle({
        userId: user.id,
        email: user.email,
        fullName,
        role,
      });
      if (role === "supervisor" && !next.startsWith("/supervisor")) next = "/supervisor";
      if (role === "student") {
        const db = getSupabaseAdminClient();
        const { data: profile } = db
          ? await db.from("student_profiles").select("user_id").eq("user_id", user.id).maybeSingle()
          : { data: null };
        // New / guide-pending students always land in the mandatory tour.
        if (!profile || productGuidePending(user)) {
          next = "/portal/packs?guide=1";
          await supabase.auth.updateUser({ data: withProductGuidePending((user.user_metadata ?? {}) as Record<string, unknown>) }).catch(() => null);
        }
      }
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/portal?auth_error=missing_code`);
}
