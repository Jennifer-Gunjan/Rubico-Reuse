# Rubico ReUse

An internal marketplace where Rubico colleagues in **Haridwar** and **Dehradun** donate, exchange, sell and lend items they no longer need, and post "wanted" requests for things they are looking for.

- Live site: https://rubico-reuse.vercel.app
- Anyone can **look** at listings (landing page, Browse, listing pages). Everything else needs a sign-in with a **@rubicotech.com** or **@rubicotech.in** account.
- Release notes: [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md) · Operations runbook: [docs/HANDOVER.md](docs/HANDOVER.md) · Demo and acceptance checklist: [docs/DEMO_AND_UAT.md](docs/DEMO_AND_UAT.md)

## Contents
1. [What it does](#1-what-it-does)
2. [How it works](#2-how-it-works)
3. [Tech stack](#3-tech-stack)
4. [Project layout](#4-project-layout)
5. [Run it on your computer](#5-run-it-on-your-computer)
6. [Set up your own copy from scratch](#6-set-up-your-own-copy-from-scratch)
7. [Settings (environment variables)](#7-settings-environment-variables)
8. [Tests and checks](#8-tests-and-checks)
9. [Working on the code](#9-working-on-the-code)
10. [Releasing and rolling back](#10-releasing-and-rolling-back)
11. [Operations: backups, moderation, clean-up](#11-operations-backups-moderation-clean-up)
12. [Troubleshooting](#12-troubleshooting)
13. [Known limits](#13-known-limits)

## 1. What it does

| Area | Behaviour |
| --- | --- |
| Preview | Landing page, Browse and listing pages are readable signed out. Only live items show, with no giver name or contact details. Listing pages ask search engines not to index them |
| Sign-in | Google, or an emailed link. Accounts outside the two Rubico domains are refused and signed out |
| First login | Name, city and Teams handle must be filled in first; the person then continues where they were heading |
| Listings | Title, description, category, condition, city, up to four photos (JPG or PNG, 2 MB each). Types: **Free**, **Exchange**, **Sell** (price, negotiable), **Lend** (duration). Edit, close, relist |
| Search | Text search plus category, city and type filters |
| Requests | A message and optional offered items. One active request per person per item. Withdraw, reject, accept. One winner only; if a deal falls through the item returns to Available |
| Hand-over | Given, Lent, Returned and relist states |
| Contact sharing | Name, email and Teams handle are shared **only between the two matched people** after Accept |
| Wanted board | Post what you need; colleagues answer "I have this"; mark fulfilled |
| Notifications | In-app list with a count in the menu, plus emails (with retries) |
| Safety | Banned-item keyword filter on listings and wanted posts; "Report this listing" goes to the product owner |

## 2. How it works

```
Browser ──► Next.js on Vercel (pages, server actions, middleware)
               │
               ├─► Supabase Auth      (Google / email link, domain lock)
               ├─► Supabase Postgres  (data + the rules, enforced by the database)
               ├─► Supabase Storage   (photos, bucket listing-images)
               └─► SMTP (Gmail)       (notification and report emails)
```

Important design points:

- **Rules live in the database**, not only in the screens: row-level security, a trigger that allows only legal status changes, and functions (`create_request`, `accept_request`, `fall_through`, `close_listing`, `respond_wanted`, and so on) that do each step in one safe transaction. The app cannot bypass them.
- **Public preview** reads two SELECT-only views, `public_listings` and `public_listing_images`. They expose live listing content only, never the owner.
- **One winner:** unique partial indexes and a fixed lock order make two simultaneous accepts produce exactly one winner (tested on real Postgres).
- **Emails** are queued in the `notifications` table, sent right after each action, and retried daily by a Vercel cron job (`/api/cron/emails`, protected by `CRON_SECRET`, three attempts per row). If email is not configured the rows stay pending and in-app notifications still work.
- **Domain lock** is checked three times: the database trigger on sign-up, the middleware on each request, and the login callback.

## 3. Tech stack

Next.js 15 (App Router, TypeScript) · Supabase (Postgres, Auth, Storage) · Vercel · Nodemailer over SMTP · Vitest · PGlite (in-process Postgres for tests) · Playwright and axe-core · GitHub Actions. Node 22 is required.

## 4. Project layout

```
src/app/                 Pages and server actions
  page.tsx, LoginForm    Landing page with preview and sign-in
  browse/                Listing grid and filters
  listings/[id]/         Listing detail, request panel, report form; new/ and edit/
  my/ wanted/ notifications/ profile/    Signed-in pages
  auth/callback, auth/signout            Sign-in completion and sign-out
  api/cron/emails        Daily email retry
src/components/          Nav, ListingGrid, Logo
src/lib/                 transitions (legal status changes), domain, banned, listing (validation),
                         profile (completeness, safe redirects, public paths), public (preview data),
                         outbox (emails), photo, supabase/ (browser, server, admin clients)
src/middleware.ts        Page protection and domain check
supabase/migrations/     0001 to 0005 SQL files (apply in order)
supabase/seed.sql        Demo data; seed_remove.sql removes it
tests/                   db, api, concurrency, live, e2e
docs/                    Handover, release notes, demo and UAT
.github/workflows/ci.yml CI pipeline
```

## 5. Run it on your computer

You need Git, **Node.js 22**, and a Supabase project (see section 6 if you do not have one yet).

```bash
git clone https://github.com/Jennifer-Gunjan/Rubico-Reuse.git
cd Rubico-Reuse
npm ci
cp .env.example .env.local      # Windows PowerShell: Copy-Item .env.example .env.local
```

Edit `.env.local` (no quotes, no spaces around `=`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

Then:

```bash
npm run dev
```

Open http://localhost:3000. **Restart the dev server after any change to `.env.local`**; the image host list is read once at start-up.

For Google sign-in locally, add `http://localhost:3000/auth/callback` to the Supabase redirect allow-list. The local app talks to the real Supabase project, so use test accounts and clean up afterwards.

## 6. Set up your own copy from scratch

Follow these in order. Never paste secrets into chat, tickets or the repository.

### 6.1 Supabase
1. Create a project at supabase.com.
2. SQL editor: run every file in `supabase/migrations` **in numeric order** (0001 to 0005). They are additive; never edit an applied file, add a new numbered one.
3. Storage: migration 0002 creates the public bucket `listing-images`.
4. Authentication → URL Configuration: Site URL = your site; Redirect URLs include `https://<your-site>/auth/callback` (and `http://localhost:3000/auth/callback` for local use). **Do not add query strings.**
5. Copy the project URL, the publishable (anon) key, and, for server use only, the service-role key (Project Settings → API).

### 6.2 Google sign-in
1. console.cloud.google.com: create a project, then the OAuth consent screen. Choose **Internal** if you use Google Workspace, otherwise **External** and add test users (up to 100) while in Testing.
2. Credentials → OAuth client ID → Web application. Authorised JavaScript origin: your site. Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → Google: paste client ID and secret, save.
4. The work email must be a Google account. The emailed-link login also exists, but Supabase's built-in sender allows only a few emails per hour; for more, set custom SMTP in Supabase (Authentication → Emails → SMTP Settings).

### 6.3 Email (notifications and reports)
1. Use a dedicated mailbox, for example a new Gmail account. Turn on 2-step verification and create an **app password**.
2. Set `SMTP_USER` and `SMTP_PASS` (section 7). Any other SMTP host works by also setting `SMTP_HOST`, `SMTP_PORT` and `SMTP_FROM`.
3. Gmail allows about 500 emails a day, and mail may land in spam at first. A company mailbox or verified domain gives better delivery.

### 6.4 Vercel
1. Import the GitHub repository at vercel.com (framework: Next.js). Production branch: `main`.
2. Add the environment variables from section 7 (Production, and Preview if wanted), then deploy.
3. `vercel.json` already schedules the daily email retry.

### 6.5 GitHub
1. Protect `main`: require a pull request and the `check` status check.
2. Actions secrets for the live tests: `LIVE_TEST_EMAIL`, `LIVE_TEST_PASSWORD`, `LIVE_TEST_EMAIL_2`, `LIVE_TEST_PASSWORD_2` (two test accounts created in Supabase Auth with Auto Confirm User, using allowed-domain addresses). Optional: `LIVE_SUPABASE_URL`, `LIVE_SUPABASE_ANON_KEY` (the workflow has fallbacks).

### 6.6 Other domains
To allow another company domain, insert it in `allowed_domains` (SQL) **and** add it to `ALLOWED_DOMAINS` in `src/lib/domain.ts`; the server checks both.

## 7. Settings (environment variables)

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Local, Vercel | Project URL (also sets the allowed photo host) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local, Vercel | Public publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server only) | Lets the server send queued emails. Never expose or commit it |
| `SMTP_USER`, `SMTP_PASS` | Vercel | Sender mailbox and app password. Unset means emails stay pending |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Optional | Defaults: `smtp.gmail.com`, `465`, `Rubico ReUse <SMTP_USER>` |
| `PRODUCT_OWNER_EMAIL` | Vercel | Receives "Report this listing" emails |
| `NEXT_PUBLIC_APP_URL` | Vercel | Used for links inside emails |
| `CRON_SECRET` | Vercel | Protects the daily retry route |

If a secret leaks, rotate it in its own service and update it here. `.env.local` must never be committed.

## 8. Tests and checks

```bash
npm run lint          # zero warnings allowed
npm run typecheck
npm test              # unit, API and database tests, no setup needed
npm run build
npm run e2e           # browser tests; build first, Playwright browsers installed
```

| Suite | What it covers |
| --- | --- |
| `src/lib/*.test.ts` | Every status transition, domain lock, banned items, validation, profile and redirect rules, emails |
| `tests/db` | Database rules on in-process Postgres, including the public views |
| `tests/api` | Login callback, first-login redirect, sign-out, page protection |
| `tests/concurrency` | Simultaneous accepts and other races on real Postgres (needs `CONCURRENCY_DATABASE_URL`; CI provides one) |
| `tests/live` | The real Supabase project's API rules (needs the `LIVE_TEST_*` variables) |
| `tests/e2e` | Browser: anonymous checks and preview, login-page accessibility; the two-account journey and signed-in accessibility run with `E2E_EMAIL(_2)` and `E2E_PASSWORD(_2)` |

CI (`.github/workflows/ci.yml`): `check`, `races` and `e2e-anonymous` run on every push; `live-api` and `e2e-journey` run after merges to `main` or by hand from the Actions tab, and fail loudly if their secrets are missing. The browser tests leave finished `[E2E]` items in the live database (hidden from Browse); see section 11.

## 9. Working on the code

1. Branch from `main`: `git checkout -b my-change`.
2. Make the change. For a new rule or table, add a new migration file and a test in `tests/db`.
3. Run `npm run lint && npm run typecheck && npm test && npm run build`.
4. Push and open a pull request into `main`. Merge when CI is green.

Conventions: server actions are `async function` declarations; do not put query strings in the Supabase redirect URL (the post-login destination travels in a short-lived cookie); views must `revoke all` and grant SELECT only, because Supabase grants broad rights on new objects by default.

## 10. Releasing and rolling back

- **Release:** merge to `main` with CI green. Vercel deploys automatically. After merging, open the CI run on `main` and confirm the live jobs are green. Apply any new migration in the Supabase SQL editor **before** merging code that needs it.
- **Roll back the site:** Vercel → Deployments → promote the last good Production deployment (seconds, does not touch data). Database changes are additive, so no data rollback is needed.

## 11. Operations: backups, moderation, clean-up

**Backups.** Check Supabase → Project Settings → Database → Backups. On the free plan take your own weekly dump (connection string from the Connect button; keep it in a password manager):

```bash
pg_dump "$DB_URL" --data-only --no-owner --no-privileges \
  --table='public.*' --table=auth.users -Fc -f reuse-$(date +%F).dump
```

Restore into a fresh project: apply all migrations; `truncate public.allowed_domains`; `pg_restore --data-only --disable-triggers --no-owner -d "$NEW_DB_URL" <dump>`; check row counts; update the three Supabase values in Vercel. Photos are not in the dump; copy the `listing-images` bucket separately. Practise this quarterly.

**Moderation (SQL editor).**
```sql
select r.created_at, l.title, l.id, r.reason
  from reports r join listings l on l.id = r.listing_id order by r.created_at desc;
delete from listings where id = '<listing id>';          -- take a listing down
```

**Clean-up.** Test items: `delete from listings where title like '[E2E]%';`. Demo data: run `supabase/seed_remove.sql` (load it with `supabase/seed.sql`).

## 12. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| "hostname ... is not configured under images" | Dev server started before `.env.local` was set. Stop it, delete `.next`, check `NEXT_PUBLIC_SUPABASE_URL` has no quotes or trailing path, run `npm run dev` again |
| Preview sections are empty | Migration 0005 not applied, or the Supabase URL/key is wrong |
| Sign-in email "could not be sent, try again in a minute" | Supabase built-in email limit. Use Google sign-in or set custom SMTP in Supabase |
| Google sign-in "redirect_uri_mismatch" | The Google redirect URI must be exactly `https://<project>.supabase.co/auth/v1/callback` |
| Google sign-in "access blocked" | Consent screen is External in Testing and the person is not a listed test user |
| Signed in with Gmail, sent back to login with an error | Expected: only the Rubico domains are allowed |
| "relation profiles does not exist" | Migrations were not applied; run them in order |
| Profile not found after sign-in | Run migration 0003 (backfill), then sign out and in again |
| Emails not arriving | Check `SMTP_USER`/`SMTP_PASS` in Vercel, the spam folder, and `notifications.email_status` in Supabase (`pending`, `sent`, `failed`) |
| CI job fails with "secrets are missing" | Add the four `LIVE_TEST_*` secrets under GitHub → Settings → Secrets and variables → Actions |
| Local `localhost` Postgres tests skip | Concurrency and live tests need their environment variables; `npm test` alone is enough for everyday work |

## 13. Known limits

- The banned-item list is a keyword filter, light protection only; confirm the list with the product owner.
- Gmail SMTP: about 500 emails a day; may reach spam at first.
- No admin screen, chat, ratings, payments, maps or automatic image resizing.
- Typing into a form before the page has fully loaded can clear fields (rare).
- Listing text and photos are visible to anyone on the internet by design; giver identity and contact details are not.
