import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";

import { getGoogleOAuthRedirectUri } from "@/lib/site-url";
import { getSessionActor } from "@/lib/workspace/access";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DRIVE_FULL_SCOPE = "https://www.googleapis.com/auth/drive" as const;

export async function GET() {
  const actor = await getSessionActor();
  if (actor?.kind !== "staff") {
    return new NextResponse("Staff only.", { status: 401 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = getGoogleOAuthRedirectUri();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in .env.local. Add them from your Google Cloud OAuth client (Web application).",
      },
      { status: 500 },
    );
  }

  if (!redirectUri) {
    return NextResponse.json(
      {
        error:
          "Set NEXT_PUBLIC_APP_URL (e.g. https://inova.honiccompany.com) or GOOGLE_OAUTH_REDIRECT_URI so the OAuth callback URL is known. See docs/production-hosting.md.",
      },
      { status: 500 },
    );
  }

  // Anti-CSRF: a random state, stored in a short-lived HTTP-only cookie, must come back unchanged.
  const state = randomBytes(24).toString("hex");
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [DRIVE_FULL_SCOPE],
    state,
  });

  const jar = await cookies();
  jar.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google/oauth",
    maxAge: 600,
  });

  return NextResponse.redirect(url);
}
