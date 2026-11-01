# Handoff: Honic project chat (8 Oct to 31 Oct 2026)

Read this first. The full conversation is in `full-chat.md` (same folder, secrets removed).

**Starting a new Cursor chat:** type `@docs/chat-handoff/HANDOFF.md read this and continue from "Next steps"`.

## Run on a new PC

1. Install [Node.js](https://nodejs.org) 20 or newer, and Python 3 if you need the PDF scripts (`pip install fpdf2 openpyxl pymupdf python-docx`).
2. Unzip the project and open the folder in Cursor.
3. In a terminal in the project folder: `npm install`, then `npm run dev`.
4. Open http://localhost:3000. `.env.local` is included in the zip, so it connects to the same Supabase.

## Who and what

- User works at **Honic Company Limited, Innovation and Research Department**.
- Repo: `E:\honic\project`. Next.js 16.2.4 (App Router, Turbopack) + Supabase dashboard ("inova" internal app).
- Prefers short replies, simple English, PDFs in Honic style for documents.

## Current state

### Done

- **Title documents** (all in `docs/`):
  - `Electronic-Components-Testing-Kit.docx`: simple doc for title 9 (client MATUTU), with the ASCII front-panel box removed.
  - `Honic-Setup-Guide.pdf/.docx`: how to set up a new PC with Git, Supabase, Google Drive, Vercel, and Cursor.
  - `New-Solution-Titles-BENG22ETE.pdf`: 5 reworked ETE titles.
  - `ETE-Hardware-Topics-from-BENG22COE.pdf/.xlsx`, `ETE-Topics-New-Titles.pdf`, `ETE-Topics-Original-Titles.pdf`: 10 ETE hardware topics from the COE list.
  - `Topic-1-Solar-Phone-Charging-Kiosk.pdf`: technical doc for topic 1.
  - `To-Jecsa.pdf`: 3 titles for Jecsa:
    1. Ambulance Patient Telemetry Unit (COE No. 57)
    2. Digital Forest Canopy Densiometer (new idea; original title "None")
    3. Development of RTK GNSS Smart Boundary Beacons with LoRa Tamper Alerts: A Case Study of Game Reserve Land Protection (COE No. 104)
  - Source spreadsheets: `BENG22ETE-MIN2.xlsx` (43 titles), `BENG22COE-Project-Realization-Complete-Titles.xlsx` (107 titles).
- **Project titles page** at `/titles` (internal dashboard, sidebar "Project titles"):
  - Files:
    - `src/app/titles/page.tsx`, `src/app/titles/actions.ts`
    - `src/lib/title-bank.ts`
    - `src/components/titles/title-proposals-board.tsx`, `src/components/titles/last-year-projects-table.tsx`
  - Database: `supabase/024_project_title_bank.sql` is **applied**. Tables:
    - `last_year_projects`: 150 rows (43 ETE, 107 COE)
    - `title_proposals`: 18 rows (15 available, 3 reserved for Jecsa)
  - New titles: reserve, assign, release, drop, delete, add.
  - Last year projects: filter, search, "New title" (creates a proposal from a past project), delete.
- **Startup crash fixed:**
  - Problem: the share-link route folders `api/share/[slug]` and `api/share/[token]` conflicted.
  - Fix: the file route moved to `src/app/api/share/[slug]/file/[fileId]/route.ts` and reads the `slug` param as the share token. URLs are unchanged.
- **Login page:** removed the "Internal workflow on ... Client share links stay public without login." text.
- **Student portal SAMPLE** at `/portal` (public, no login):
  - `src/app/portal/page.tsx`, `src/components/portal/title-portal-sample.tsx`
  - Browser-only mock data; nothing saved.
  - Flow: create account → details → titles for course → select → pay TSh 10,000 to change.
  - `/portal` was added to `src/lib/auth-public-paths.ts`.

## Database (done 1 Nov 2026)

The dashboard (and the future student portal) has its own Supabase project, fully isolated from the Honic online shop.

| | Dashboard project | Shop project (not ours) |
|---|---|---|
| Ref | `fpzpcsiczzmwppgmoeem` (eu-central-1) | `qobobocldfjhdkpjyuuq` (ca-central-1) |
| Used by | inova.honiccompany.com + share.honiccompany.com (live since 1 Nov 2026) | Honic online shop only |
| Contents | 8 tables: registered_clients, tracked_projects, project_milestones, project_tasks, project_share_links, project_share_push_subscriptions, last_year_projects, title_proposals; 1 login (inova, staff) | 35 shop tables, 31 customer logins, invoices. All dashboard tables, functions, triggers and the inova login were removed. |

- Schema: `supabase/v2/001_dashboard_baseline.sql`. RLS is on for every table with no anon/authenticated policies; the app only uses the service role (secret key) on the server. Public sign-up is disabled.
- Staff-only access: `src/lib/auth-staff.ts` (app_metadata.role = "staff"), checked in `src/middleware.ts` and the login action. `npm run auth:ensure-operator` creates a staff user or grants the role (AUTH_OPERATOR_EMAIL / AUTH_OPERATOR_PASSWORD).
- Clients are added by hand on /clients (Add client). There is no link to shop invoices any more.
- `supabase/legacy-shared-db/` is history only; `099_remove_dashboard_from_shop_db.sql` records the cleanup that was run on the shop project.
- `.env.local` has the 13 app settings and is identical to Vercel's variables (imported 1 Nov 2026). `.env.example` is the same layout with empty values.
- Backups (outside the repo) are in `E:\honic\backups\`:
  - `dashboard-tables-2026-11-01*`
  - `shop-db-dashboard-final-2026-11-01` (tables, function definitions, old login)
  - `env-local-before-cleanup-2026-11-01.txt`
- To run SQL from Cursor: the user creates a Supabase personal access token for `fpzpcsiczzmwppgmoeem`. Use it with `POST https://api.supabase.com/v1/projects/fpzpcsiczzmwppgmoeem/database/query` and body `{"query": "..."}`. Never print the token, never put it in `.env.local` or Vercel, and ask the user to delete it afterwards. The earlier tokens were removed from this PC.
- The direct host `db.<ref>.supabase.co` is IPv6-only and doesn't work on the office network; use the Management API or the Session pooler.

## Student portal host

- The portal lives on **https://share.honiccompany.com/portal**. `share.honiccompany.com/` redirects there, and `inova.honiccompany.com/portal` redirects to the share host. The rules are in `src/middleware.ts` (`isPortalPath`).
- Student sessions use cookies on the share host only, separate from staff cookies on inova. Portal APIs should go under `/api/portal/` (already allowed on the share host).
- When building real sign-up, add `https://share.honiccompany.com/**` to Supabase > Authentication > URL Configuration > Redirect URLs, and re-enable sign-up (disabled now). Students must never get `app_metadata.role = "staff"`.

## Portal accounts: two stages (decided 1 Nov 2026)

- People without an account keep using share links, unchanged.
- **Stage 1, title:** a student signs up on share.honiccompany.com/portal (students only: name, reg no, course, year required). They pick one title for their course; changing costs TSh 10,000.
- **Stage 2, project:** the account is linked to a tracked project, so the portal shows the "My project" tab (the same content as the share page: checklist, files, references) next to the "My title" tab. Nothing disappears.
- **Linking:** both ways. It happens automatically when staff create a project from a student's selected title, and staff can also link by email on the project page. One project per account.
- **Notifications:** email the student when staff publish an update on their linked project. This needs an email provider (not configured yet).
- **Security:** a student only sees their own linked project (enforced by RLS), and never gets the staff role.

## Decisions made for the real student portal

| Topic | Decision |
|---|---|
| Change fee | TSh 10,000 |
| First title | Free; pay only to change |
| Old title after paid change | Goes back to the list for others |
| Student sign-up | Email + password with email verification |
| Selection | One title per student (individual, not group) |
| Payment provider | Assistant recommended AzamPay (ClickPesa as alternative), with a manual fallback: student pays to a Honic number, enters the transaction ID, staff confirm on dashboard |
| Courses | User will list them (not yet given) |

## Next steps (waiting on the user)

1. **User to send:** the list of courses, and whether they provide titles per course or the assistant drafts ~10 per course. The current 18 proposals are all ETE-style hardware titles.
2. Then build, in this order:
   1. **Staff-only lockdown (must come first).**
      - Problem 1: today any logged-in Supabase user can open the internal dashboard (`src/middleware.ts` only checks for a session).
      - Problem 2: several RLS policies allow any `authenticated` user to write. Examples: `tracked_projects` insert/update/delete in `006`, and the `title_proposals` / `last_year_projects` "auth_all" policies in `024`.
      - Fix: mark staff with `app_metadata.role = 'staff'`, check it in middleware and server actions, and restrict those policies to staff.
   2. **Migration 025:**
      - New tables: `courses`, `student_profiles` (user_id, full_name, reg_no unique, phone, institution, course, year, academic_year), `title_selections` (history), `title_change_payments`.
      - Add a course column to `title_proposals`.
      - A locked `select_title` function, so two students can't take the same title and a student can't hold two.
   3. **Real `/portal` pages:**
      - sign up / sign in with email verification
      - profile
      - titles for my course
      - my title
      - pay to change
   4. **Payments:** AzamPay sandbox plus a webhook route; a manual-confirm fallback on the dashboard.
   5. **Dashboard `/titles`:** show the holder of each title, staff release, payments list.

## Other open items

- All work is committed and pushed to GitHub `main`. `docs.rar` and `scripts/_tmp-titles-pdf.py` were deleted at the user's request (1 Nov 2026).
- User was advised to delete the two Supabase personal access tokens used for the move (supabase.com/dashboard/account/tokens), and to reset the shop project's database password, which appeared in chat.
- Vercel flags some variables "Needs Attention"; marking them Sensitive is optional.
- Pre-existing lint error in `src/components/dashboard/dashboard-shell.tsx` (react-hooks/set-state-in-effect); left as is.

## Conventions and gotchas

- **Shell:** Windows PowerShell. Avoid complex `python -c` / `node -e` quoting. Write temp scripts as `scripts/_tmp-*.py` and delete them after.
- **Dev server:** `npm run dev` in `E:\honic\project`, port 3000. Internal pages redirect to `/login`.
- **Honic PDF style** (fpdf2 + Arial TTF from `C:\Windows\Fonts`):
  - colours: NAVY (12,74,110), INK (30,41,59), MUTED (71,85,105), ZEBRA (241,245,249)
  - header: "HONIC COMPANY LIMITED · Innovation and Research Department", rule at y=17
  - footer: "… · Page X of {nb}"
  - measure table rows with `multi_cell(..., dry_run=True, output="LINES")` using the same font and width as rendering
  - check layout by rendering pages to PNG with PyMuPDF (`fitz`)
- **Secrets:** never print values from `.env.local`; mask when checking.
