# Handoff: Honic project (8 Oct to 1 Nov 2026)

Read this first. Readable chat history: `full-chat.md` (same folder, secrets removed). Raw Cursor chat files are in the zip's `chats/` folder.

**Starting a new Cursor chat:** type `@docs/chat-handoff/HANDOFF.md read this and continue`.

## Run on a new PC

1. Install [Node.js](https://nodejs.org) 24 (20 or newer works), [Git](https://git-scm.com), and Python 3 for the document scripts (`pip install fpdf2 openpyxl pymupdf python-docx pillow`).
2. Unzip, open the `project` folder in Cursor.
3. Terminal in the project folder: `npm install`, then `npm run dev`, open http://localhost:3000.
4. `.env.local` (app settings) and `.env.tools.local` (Supabase access token for `npm run db:migrate`) are in the zip. Keep the zip private.
5. Git: the `.git` folder is included, so `git pull` / `git push` work after you sign in to GitHub on the new PC.

## Who and what

- User: **Honic Company Limited, Innovation and Research Department**. Prefers short replies in simple English, PDFs/Word in Honic style.
- Repo `E:\honic\project` (GitHub `main`, Vercel auto-deploys). Next.js 16.2.4 App Router + Turbopack, Supabase, Vercel.
- Sites: **inova.honiccompany.com** (staff dashboard, staff login only) and **share.honiccompany.com** (client share links + student portal at `/portal`).

## Working rules (also in `.cursor/rules/database-and-deploy.mdc`)

- After every change: DB change → new `supabase/v2/NNN_*.sql` + `npm run db:migrate`; then type-check, lint, commit, `git push origin main` (deploys).
- Secrets: never print them. `SUPABASE_ACCESS_TOKEN` stays in `.env.tools.local` (never `.env.local`, which is imported into Vercel).
- Windows PowerShell: write temp scripts as `scripts/_tmp-*.py`, run them after the file exists, delete after. Use Python `urllib` (not `Invoke-RestMethod`) for Supabase REST with the service key.
- Don't run two Cursor chats on this project at the same time (they overwrote each other once).

## Database

- Supabase project `fpzpcsiczzmwppgmoeem` (eu-central-1), isolated from the shop DB `qobobocldfjhdkpjyuuq` (never touch it).
- Migrations `supabase/v2/001`–`006`, tracked in `ops.schema_migrations`. RLS on everywhere, no public policies; the app uses the service role on the server only.
- `npm run db:migrate -- --status` shows applied files.
- Private storage bucket `portal-files` (25 MB per file, 500 MB per workspace).

## Built so far

- **Dashboard (inova):** projects, clients, milestones, Drive, share links, working-year filter (30 Sep to 29 Sep), `/titles` title bank, **`/students`** student workspaces (filters, at-risk list, unread messages, session requests, unpaid invoices), **`/students/<id>`** full workspace with staff powers, **`/students/deadlines`** shared deadlines.
- **Student portal (share.honiccompany.com/portal):**
  - Sign up/in (email + password; Google sign-in ready but off), details form (institution and course lists with "Other", level of study, project type, year optional), title picker (all courses, top 20 matches first), simulated TSh 10,000 title change.
  - **Project workspace** (`src/components/workspace/*`, actions `src/app/portal/workspace-actions.ts`, data `src/lib/workspace/*`): Home dashboard, project details, team (partner invites by link), supervisor details and read-only supervisor link (`/portal/s/<token>`, can comment), activity, Gantt chart (drag/resize, dependencies, ready-made plans for FYP/research/innovation, catch-up rescheduling), task board, calendar, documents with versions and feedback, files, logbook, data sets with charts, parts and budget, references (IEEE/APA), messages with Honic, session booking, payments (simulated), defence checklist, printable reports (`/portal/print/*`) and CSV exports, phone alerts (web push), installable app.
  - Daily reminders: Vercel cron `/api/cron/portal-reminders` at 07:00 EAT (`vercel.json`).
- Emails: Honic-branded layout (`src/lib/email-layout.ts`) via Resend, but **not active yet** (keys missing).

## Next steps

1. **Resend emails (in progress):** user creates a Resend account, adds domain `honiccompany.com` (DNS is on Cloudflare; Resend records use the `send` subdomain and `resend._domainkey`, so existing Cloudflare email routing is safe), waits for Verified, creates a Full-access API key. Then add to `.env.local` and Vercel:
   `RESEND_API_KEY=re_...` and `EMAIL_FROM="Honic Company Limited <portal@honiccompany.com>"`, redeploy, and run `npm run email:setup` (switches Supabase auth emails to Resend SMTP with Honic templates, 100 emails/hour). Then send a test confirmation email.
2. Optional: `CRON_SECRET` in Vercel to protect the reminder job.
3. Google sign-in: Google OAuth client with redirect `https://fpzpcsiczzmwppgmoeem.supabase.co/auth/v1/callback`, enable Google in Supabase, set `PORTAL_GOOGLE_SIGNIN=true` in Vercel.
4. Real mobile-money payments (AzamPay suggested) to replace the simulated step.
5. Titles for courses other than ETE (waiting on the user).

## Gotchas

- Cursor's browser adds `data-cursor-ref` attributes, which can show a fake hydration warning in dev.
- Server components can't call functions from `"use client"` files; shared helpers live in `src/lib/workspace/links.ts`.
- Pre-existing lint error in `src/components/dashboard/dashboard-shell.tsx` (set-state-in-effect), left as is.
- The Next dev log prints server-action arguments (including passwords typed in tests); it is dev-only.
- Honic PDF style: fpdf2 + Arial; NAVY (12,74,110), INK (30,41,59), MUTED (71,85,105); header "HONIC COMPANY LIMITED · Innovation and Research Department".
