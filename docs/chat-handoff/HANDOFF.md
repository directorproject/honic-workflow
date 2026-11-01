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

### Database access for the assistant

- `.env.local` has `SUPABASE_ACCESS_TOKEN` (Supabase personal access token). Use it to run SQL through the Management API:
  - `POST https://api.supabase.com/v1/projects/qobobocldfjhdkpjyuuq/database/query`
  - body: `{"query": "..."}`
  - header: `Authorization: Bearer <token>`
  - Read the token from `.env.local`; never print it.
- Direct host `db.<ref>.supabase.co` is IPv6-only and doesn't work on this network.
- Project ref `qobobocldfjhdkpjyuuq`, region `ca-central-1`, pooler `aws-1-ca-central-1.pooler.supabase.com`.

## Database move (1 Nov 2026): IN PROGRESS

The old Supabase project `qobobocldfjhdkpjyuuq` is shared with the Honic online shop (45 tables, 31 shop customer logins). The dashboard and the future student portal moved to their own project `fpzpcsiczzmwppgmoeem` (eu-central-1). The two are fully isolated: the dashboard no longer reads anything from the shop. Clients are added by hand on /clients ("Add client").

Done:
- Schema: `supabase/v2/001_dashboard_baseline.sql` applied to the new project. It has 8 tables. RLS is on everywhere with no anon/authenticated policies; the app only uses the service role.
- The old shared-DB migrations moved to `supabase/legacy-shared-db/` (history only).
- Data copied with IDs kept, and count + checksum verified for every table. Backup JSON is in `E:\honic\backups\dashboard-tables-2026-11-01\`.
- The staff user `inova@inova.local` was copied with the same password and `app_metadata.role = "staff"`. The old project's staff user also got the role.
- New project auth: site URL https://inova.honiccompany.com, sign-up disabled.
- Code:
  - Staff-only access: `src/lib/auth-staff.ts`, checked in `src/middleware.ts` and `src/app/login/actions.ts`.
  - Add-client form (`src/components/clients/add-registered-client-form.tsx`).
  - Shop invoice sync removed.
  - Unused files removed: invoice-stat-cards, kpi-grid, stat-cards, supabase/browser, docs.rar, scripts/_tmp-titles-pdf.py.
- `.env.local` on this PC points at the new project. The old values are kept as `OLD_*` for rollback. Each Supabase access token only works on one project: `SUPABASE_ACCESS_TOKEN` is the old one and `NEW_SUPABASE_ACCESS_TOKEN` the new one.

Remaining:
1. Cutover:
   1. Run `python scripts/_tmp-copy-data.py --resync`. This empties the new tables and copies fresh data, because the live site still writes to the old DB.
   2. User sets these Vercel env vars to the new project, then redeploys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   3. Test the live site.
2. After the live site is confirmed (user approved):
   - Back up, then drop the 10 dashboard tables (8 + sample `clients`/`projects`) from the old shop project.
   - Drop the 9 dashboard functions and the `trg_invoices_sync_registered_client` trigger on `invoices`. Keep `invoices`.
   - Delete the `inova@inova.local` login there.
   - Shop backup tables (`orders_backup`, `order_items_backup`, `profiles_backup`) stay; the shop maintainer decides.
3. Then remove `OLD_*` and `SUPABASE_ACCESS_TOKEN` from `.env.local`, delete `scripts/_tmp-*.py`, and update `docs/Honic-Setup-Guide` (it still names the old project).

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

- All work up to 31 Oct 2026 is committed and pushed to GitHub `main` (commit 7053825). Not committed on purpose: `docs.rar` (user's older archive) and `scripts/_tmp-titles-pdf.py`.
- User was advised to reset the Supabase database password, which appeared in chat, and to delete the access token when done (supabase.com/dashboard/account/tokens).
- `scripts/_tmp-titles-pdf.py` existed before this work; don't delete it without asking.
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
