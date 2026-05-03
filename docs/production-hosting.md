# Production hosting (`inova.honiccompany.com`)

This app does **not** hardcode your domain. Set **`NEXT_PUBLIC_APP_URL`** and **`GOOGLE_OAUTH_REDIRECT_URI`** (or rely on the derived callback from `NEXT_PUBLIC_APP_URL`) in the environment where the server runs.

---

## 1. DNS and HTTPS

Point **`inova.honiccompany.com`** at your host the usual way:

- **Vercel / Netlify / similar:** add the hostname in the dashboard; they issue TLS and give you a **CNAME** or **ALIAS** target.
- **VPS + Nginx / Caddy:** **A** / **AAAA** records to the server; terminate TLS there and reverse-proxy to Node (e.g. `http://127.0.0.1:3000`).

There is no requirement to use Cloudflare Tunnel; that was only one possible dev/staging pattern.

---

## 2. Required environment variables (production)

In the hosting provider’s env UI (or your process manager), set at least:

```env
NEXT_PUBLIC_APP_URL=https://inova.honiccompany.com
```

OAuth callback (pick one approach):

```env
# Option A — explicit (must match Google Console exactly)
GOOGLE_OAUTH_REDIRECT_URI=https://inova.honiccompany.com/api/google/oauth/callback

# Option B — omit GOOGLE_OAUTH_REDIRECT_URI; the app uses NEXT_PUBLIC_APP_URL + /api/google/oauth/callback
```

Also set Supabase and any Google Drive / OAuth vars as in **`.env.example`**.

Restart the app after any env change.

### Share links: fixed host (`share.honiccompany.com`) vs per-client subdomains

Share URLs always include a **client segment** in the path: **`/share/{client-slug}/{token}`** (and file previews under **`/share/{client-slug}/{token}/view/{fileId}`**). The slug comes from **`registered_clients.share_subdomain`** when set and valid; otherwise it is derived from the registered client **name** (slugified). Old **`/share/{token}`** links still work and redirect to the canonical URL.

**Option A — one host for every client (typical with Vercel + `share` subdomain):**

1. Add **`share.honiccompany.com`** to **Vercel → Domains** for this project (CNAME in Cloudflare to Vercel as usual).
2. Set:

```env
NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN=https://share.honiccompany.com
```

Generated links look like **`https://share.honiccompany.com/share/{client-slug}/{token}`**.

With **`NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN`** set, **middleware** (`src/middleware.ts`) restricts that hostname to **`/share/**`, **`/api/share/**`**, **`/_next/**`**, and a few static files (`favicon.ico`, `robots.txt`, `logo.jpg`). Any other path on the share host returns **404** (dashboard and other APIs stay on **`NEXT_PUBLIC_APP_URL`** only).

**Option B — per-client wildcard hosts (`{name}-api.honiccompany.com`):**

1. Run **`supabase/012_registered_clients_share_subdomain.sql`** in the Supabase SQL editor (optional column + uniqueness).
2. In Cloudflare add **`*.honiccompany.com`** to Vercel’s target (and add the wildcard under **Vercel → Domains**).
3. Omit **`NEXT_PUBLIC_SHARE_PUBLIC_ORIGIN`** and set:

```env
NEXT_PUBLIC_SHARE_PARENT_DOMAIN=honiccompany.com
```

Links become **`https://{slug}-api.honiccompany.com/share/{client-slug}/{token}`** (unless **`share_subdomain`** overrides the hostname label).

---

## 3. Google Cloud Console

For **Web application** OAuth client:

- **Authorized JavaScript origins:** `https://inova.honiccompany.com`
- **Authorized redirect URIs:** `https://inova.honiccompany.com/api/google/oauth/callback`

Must match **`getGoogleOAuthRedirectUri()`** on the server (see `src/lib/site-url.ts`).

---

## 4. Local preview while editing

`.env.local` can match **production** (same URLs as live). Share links and OAuth then target **`https://inova.honiccompany.com`**, which is appropriate if you only smoke-test OAuth on the real host.

If you need **localhost-only** OAuth for a short test, use a separate file **`env.development.local`** (Next.js loads it only in development) with overrides, for example:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google/oauth/callback
```

Do not commit `.env.local` or `.env.development.local`.

---

## 5. Checklist

| Check | |
|--------|--|
| `NEXT_PUBLIC_APP_URL` | HTTPS, no trailing slash |
| Google redirect URI | Identical to server `GOOGLE_OAUTH_REDIRECT_URI` or `${NEXT_PUBLIC_APP_URL}/api/google/oauth/callback` |
| `metadataBase` | Set automatically from `NEXT_PUBLIC_APP_URL` in `src/app/layout.tsx` |
