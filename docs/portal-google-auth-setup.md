# Portal Google sign-in — configuration checklist

Use this when **Continue with Google** fails or Google shows `fpzpcsiczzmwppgmoeem.supabase.co` instead of **Honic Nexis**.

## What talks to what

1. Browser on **share.honiccompany.com** → Supabase Auth (`fpzpcsiczzmwppgmoeem.supabase.co`)
2. Supabase → Google OAuth
3. Google → back to Supabase `/auth/v1/callback`
4. Supabase → **share.honiccompany.com/portal/auth/callback** (your app)

Secrets live in **Supabase** (not in Vercel). Local `.env.local` is only for `npm run auth:google`.

---

## A. Supabase (mostly automated)

From the `project` folder (needs `SUPABASE_ACCESS_TOKEN` in `.env.tools.local` and `GOOGLE_OAUTH_*` in `.env.local`):

```bash
npm run auth:google
npm run auth:google -- --status
```

Expected status:

| Field | Value |
|--------|--------|
| `google_enabled` | `true` |
| `google_secret_set` | `true` |
| `site_url` | `https://share.honiccompany.com` |
| `uri_allow_list` | includes `https://share.honiccompany.com/**` and `.../portal/auth/callback` |

Manual check: [Supabase Dashboard](https://supabase.com/dashboard/project/fpzpcsiczzmwppgmoeem/auth/providers) → **Authentication → Providers → Google** → enabled, Client ID filled, secret saved.

---

## B. Google Cloud Console (you must do this in the browser)

Open: [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)

Use the **OAuth 2.0 Client ID** that matches:

`767351430863-opih2da6verf907t56i3c2tivhhdubbj.apps.googleusercontent.com`

### 1. Authorized redirect URIs (required)

Add **exactly** (no trailing slash):

```
https://fpzpcsiczzmwppgmoeem.supabase.co/auth/v1/callback
```

Keep any existing URIs for **inova** (`/api/google/oauth/callback`) if you still use Drive OAuth there.

### 2. Authorized JavaScript origins (recommended)

```
https://share.honiccompany.com
http://localhost:3000
https://fpzpcsiczzmwppgmoeem.supabase.co
```

### 3. OAuth consent screen

[APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)

- **App name:** `Honic Nexis` (or `Honic Company Limited — Nexis`)
- **User support email:** your Honic address
- **App logo:** optional (shows on Google’s page)
- **Authorized domains:** `honiccompany.com`
- **Developer contact:** your email

If **Publishing status** is **Testing**:

- Add every Gmail that should sign in under **Test users** (e.g. `iskilanga@gmail.com`).
- Or move to **Production** when you are ready (Google may ask for verification if scopes are sensitive; basic profile/email usually fine).

### 4. Enable Google+ / People API

Usually already on. If sign-in says API disabled: enable **Google People API** for the same Cloud project.

---

## C. Vercel (production app)

[Project → Settings → Environment Variables](https://vercel.com)

| Variable | Production value |
|----------|------------------|
| `PORTAL_GOOGLE_SIGNIN` | `true` |

You do **not** need `GOOGLE_OAUTH_CLIENT_SECRET` on Vercel for portal login (Supabase holds it). Rotating the secret requires re-running `npm run auth:google`.

Redeploy after changing env vars or pushing auth UI fixes.

---

## D. Show “Honic Nexis” on Google’s hostname line (optional, advanced)

Google will often still say **Sign in to `….supabase.co`** until you use a **custom auth domain** on Supabase:

1. Supabase Dashboard → **Project Settings → Custom Domains** (Auth).
2. Add something like `auth.honiccompany.com` (CNAME in Cloudflare).
3. Update Google redirect URI to use the custom auth host **only if** Supabase docs say to replace the callback URL for that setup.

The consent screen **App name** (section B.3) improves branding even before a custom domain.

---

## E. Quick test

1. Open https://share.honiccompany.com/portal?auth=signin
2. Email form should be **above** **Continue with Google** (after latest deploy).
3. Click **Continue with Google** → pick account → land on `/portal/packs` or `/portal/home` (student).

If it fails, note the **exact** message (Google red banner vs rose text under the button vs `auth_error` in the URL).

| Symptom | Likely fix |
|---------|------------|
| `redirect_uri_mismatch` | Add Supabase callback URI in Google (section B.1) |
| `Access blocked` / app not verified | Add test user or publish consent screen |
| `Google sign-in failed` right away (no Google popup) | Deploy auth fix; or Supabase Google provider off |
| Google works but back on portal with `auth_error` | Check `uri_allow_list` and `site_url` (section A) |

---

## F. Rotate client secret

1. Google Console → create new secret for the same OAuth client.
2. Put the new secret in `.env.local` as `GOOGLE_OAUTH_CLIENT_SECRET`.
3. Run `npm run auth:google` again.