# Rubico ReUse: handover and runbook

Internal marketplace for Rubico employees (Haridwar, Dehradun) to donate, exchange, sell and lend items. Live at https://rubico-reuse.vercel.app. Code: github.com/Jennifer-Gunjan/Rubico-Reuse.

## 1. What runs where

| Part | Service | Notes |
| --- | --- | --- |
| Website and server code | Vercel (Next.js 15) | Deploys from `main`. Every pull request gets a preview URL |
| Database, login, photos | Supabase (project `mdznlxohnjfbybihbtfe`) | Postgres with row-level security; Auth; Storage bucket `listing-images` |
| Email | Resend | Needs a verified sending domain before colleagues get mail (see section 6) |
| Checks | GitHub Actions | `check`, `races`, `e2e-anonymous` on every push; `live-api` and `e2e-journey` after merges to `main` |

Rules that protect people live **in the database**, not only in screens: who can see contact details, one winner per accept, legal status changes, and the @rubicotech.com / @rubicotech.in login lock. The app cannot bypass them.

## 2. Settings and secrets

Vercel, Settings, Environment Variables:

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public values the browser uses |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Sends email. Never expose it |
| `SMTP_USER`, `SMTP_PASS` | Email sending over SMTP (Gmail address + app password). Optional `SMTP_HOST` (default smtp.gmail.com), `SMTP_PORT` (465), `SMTP_FROM` |
| `PRODUCT_OWNER_EMAIL` | Receives listing reports |
| `NEXT_PUBLIC_APP_URL` | Links inside emails |
| `CRON_SECRET` | Protects the daily email retry route |

GitHub, Settings, Secrets and variables, Actions: `LIVE_TEST_EMAIL`, `LIVE_TEST_PASSWORD`, `LIVE_TEST_EMAIL_2`, `LIVE_TEST_PASSWORD_2` (two test accounts in Supabase Auth, auto-confirmed). If any secret leaks, rotate it in its own service and update it here.

## 3. Releasing and rolling back the website

- Release: merge a pull request into `main` once the `check` job is green. Vercel deploys automatically. The CI run on `main` then runs the live tests; open it and confirm every job is green.
- Roll back: Vercel, Deployments, find the last good Production deployment, menu, **Promote to Production** (or Instant Rollback). Takes seconds and does not touch the database.
- Database changes are SQL files in `supabase/migrations`, applied by hand in the Supabase SQL editor in numeric order. They are additive. Never edit an applied file; add a new numbered one.

## 4. Backup and restore

Supabase's own backups depend on your plan: check Project Settings, Database, Backups. On the free plan there are no scheduled backups, so take your own weekly dump.

Get the **Direct connection** string from Supabase (Connect button) and keep it in your password manager. Never paste it into chat or into the repository.

Backup (rehearsed on a test database, restored with identical row counts):

```
pg_dump "$DB_URL" --data-only --no-owner --no-privileges \
  --table='public.*' --table=auth.users -Fc -f reuse-$(date +%F).dump
```

This includes the **login accounts** (`auth.users`) as well as the app data. A backup of app data alone cannot be restored, because every profile points at a login account.

Restore into a fresh Supabase project:
1. Create the project, then apply every file in `supabase/migrations` in order in the SQL editor.
2. `psql "$NEW_DB_URL" -c "truncate public.allowed_domains"`
3. `pg_restore --data-only --disable-triggers --no-owner -d "$NEW_DB_URL" reuse-YYYY-MM-DD.dump`
4. Check counts: users, profiles, listings, requests.
5. Update the three Supabase values in Vercel and redeploy. Photos are not in the dump: copy the `listing-images` bucket from the Storage page if you need them.

Practise this once a quarter on a scratch project.

## 5. Moderation and admin tasks (SQL editor)

Reports arrive by email and are saved in the `reports` table.

```sql
-- recent reports with listing titles
select r.created_at, l.title, l.id, r.reason from reports r join listings l on l.id = r.listing_id order by r.created_at desc;
-- take a listing down (pending requests are rejected and people notified)
-- easiest: open the listing as its owner and Close; as admin, delete it:
delete from listings where id = '<listing id>';
-- add a company domain later
insert into allowed_domains (domain) values ('example.com');
-- demo data
-- supabase/seed.sql adds it, supabase/seed_remove.sql removes it
```

Also edit `ALLOWED_DOMAINS` in `src/lib/domain.ts` when adding a domain: the server checks both.

## 6. Known limits and open items

- **Email domain:** until a domain is verified in Resend, mail only reaches the Resend account owner. Ask whoever manages DNS to verify the sending domain (Resend, Domains). Notifications inside the app work regardless.
- **Google sign-in** needs the OAuth client set up in Google Cloud and Supabase (see the requirements doc). The email-link login works without it. Mail may land in spam at first.
- **Banned items** use a keyword list on titles and descriptions. It is light protection, not a guarantee. Confirm the list with the product owner.
- **Concurrency** is tested on real Postgres in CI. Photos are compressed only by size limit (2 MB, JPG or PNG); there is no automatic resizing yet.
- No admin screen, ratings, chat, payments or maps (out of scope for this release).
- Performance: Lighthouse on the login page scored 91 performance, 100 accessibility, 96 best practices, 91 SEO. Signed-in pages are checked for accessibility in CI, not for performance.
- Test accounts create finished `[E2E]` items in the live database after each run. They are hidden from Browse; delete them occasionally: `delete from listings where title like '[E2E]%';`

## 7. Tests

| Where | What | Count |
| --- | --- | --- |
| `src/lib` | status rules (every combination), domain lock, banned items, validation, emails | 200+ |
| `tests/db` | database rules on in-process Postgres | 21 |
| `tests/api` | login callback, sign out, page protection | 11 |
| `tests/concurrency` | simultaneous accepts and other races on real Postgres | 4 |
| `tests/live` | the real Supabase project's API rules | 6 |
| `tests/e2e` | browser: anonymous checks and login-page accessibility (13), plus the two-account journey and signed-in accessibility (gated) | 13 + gated |

Run locally: `npm test` (unit, API, database). `npm run e2e` needs a build first.

## Public preview and first-login profile (added Day 4, scope change)
- Landing (`/`), Browse and a listing page are readable signed out, via the `public_listings` and `public_listing_images` views (migration `0005_public_preview.sql`, SELECT only, live listings only, no owner id). Giver identity, requests and contact details stay behind login. Listing pages send `noindex`.
- Every action (request, post, wanted, notifications, profile) still needs a Rubico login. Anonymous visitors are sent to `/?next=<page>` and returned there after sign-in (cookie `reuse_next`, validated by `safeNext`).
- First sign-in with an incomplete profile goes to `/profile?welcome=1`; saving continues to the original destination.
- **Run `0005_public_preview.sql` in Supabase before deploying**; without it the preview shows empty.
- This relaxes the original "employees only" audience: listing text and photos are visible to the internet. Revert by removing `/browse`, `/listings/<id>` from `isPublicPath` in `src/lib/profile.ts`.
