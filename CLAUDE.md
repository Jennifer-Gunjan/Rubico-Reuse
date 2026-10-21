# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Rubico ReUse: internal marketplace (donate / exchange / sell / lend) for Rubico employees. Next.js App Router + Supabase (Postgres, Auth, Storage), deployed on Vercel. `docs/HANDOVER.md` is the ops runbook (env vars, release/rollback, backup, moderation SQL); `docs/DEMO_AND_UAT.md` is the demo script and acceptance checklist.

## Commands

```
npm run dev                  # needs .env.local (copy .env.example; Supabase URL + anon key)
npm run lint                 # eslint, --max-warnings=0
npm run typecheck
npm test                     # vitest: src/**/*.test.ts and tests/**/*.test.ts
npm run build
npm run e2e                  # Playwright; starts `next start` on :3100, so run `npm run build` first
```

CI runs `lint && typecheck && test && build`. Single test: `npx vitest run src/lib/transitions.test.ts` or `npx vitest run -t "name"`; single e2e: `npx playwright test anonymous`.

Some suites skip unless env vars are set (CI sets them):
- `tests/concurrency` needs `CONCURRENCY_DATABASE_URL` pointing at an **empty scratch Postgres**. It drops the `public`, `auth` and `storage` schemas.
- `tests/live` needs `LIVE_SUPABASE_URL`, `LIVE_SUPABASE_ANON_KEY`, `LIVE_TEST_EMAIL`, `LIVE_TEST_PASSWORD` (the real Supabase project).
- `tests/e2e/journey` and `a11y-app` need `E2E_EMAIL`/`E2E_PASSWORD` and `E2E_EMAIL_2`/`E2E_PASSWORD_2` (live project). `E2E_BASE_URL` tests a deployed URL instead of a local build. `PW_EXECUTABLE` overrides the Chromium path.

## Architecture

**Business rules live in the database, not the app.** `supabase/migrations/*.sql` defines RLS, the listing status state machine (`listings_guard` trigger, `can_transition`), the domain lock (`enforce_domain`), contact-detail visibility, and the SECURITY DEFINER RPCs (`create_request`, `accept_request`, `reject_request`, `withdraw_request`, `fall_through`, `close_listing`, `respond_wanted`). Server actions in `src/app/**/actions.ts` are thin wrappers: validate UUIDs, call `supabase.rpc(...)` or a plain update, `revalidatePath`, then `after(flushOutbox)`.

**Logic is duplicated by design and must stay in step:**
- `src/lib/transitions.ts` mirrors the DB `can_transition`.
- `src/lib/domain.ts` `ALLOWED_DOMAINS` mirrors the `allowed_domains` table / `is_allowed_email`. Adding a company domain means editing both.
- `src/lib/profile.ts` `profileComplete` mirrors the DB `profile_complete()`.

**Migrations** are applied by hand in numeric order (Supabase SQL editor or `supabase db push`). They are additive: never edit an applied file, add a new numbered one. `tests/db/harness.ts` replays every migration into in-process PGlite with a stub of the `auth`/`storage` schemas, so `tests/db/*` exercises the real SQL and RLS (`as(db, uid, fn)` runs a callback as that user; `mkUser`, `mkListing` build fixtures). New SQL needs a test there.

**Auth and access** (`src/middleware.ts`): refreshes the Supabase session on every request, signs out any non-allowed email domain, and redirects anonymous visitors to `/?next=...`. It fails closed when Supabase env vars are missing. Public (signed-out) paths are defined only by `isPublicPath` in `src/lib/profile.ts` (landing, `/browse`, a single listing, `/auth/callback`, the cron route); public reads go through the `public_listings` / `public_listing_images` views (migration 0005), never the base tables. Post-login redirects go through `safeNext`. An incomplete profile sends the user to `/profile?welcome=1`.

**Three Supabase clients** in `src/lib/supabase/`: `server.ts` (cookie-bound, for server components/actions), `browser.ts`, and `admin.ts` (service role, server only; used by the outbox).

**Email outbox** (`src/lib/outbox.ts`): notifications are DB rows with `email_status` / `email_attempts`. `flushOutbox` sends pending ones over SMTP via nodemailer (Gmail by default), max 3 attempts, never throws, and is a no-op without SMTP env vars. It runs after server actions and from the daily cron `/api/cron/emails` (`vercel.json`, protected by `CRON_SECRET`). Only `request_accepted` and `wanted_response` emails include the other party's contact details. Reports go to `PRODUCT_OWNER_EMAIL` via `sendReport`.

**Tests by layer:** `src/lib/*.test.ts` unit (pure logic); `tests/db` rules on PGlite; `tests/api` route handlers; `tests/concurrency` races on real Postgres; `tests/live` the deployed Supabase API; `tests/e2e` Playwright (anonymous + axe accessibility run everywhere; the two-account journey is gated on credentials and leaves `[E2E]` listings in the live DB).

Path alias `@/` maps to `src/`. Listing photos come from the Supabase Storage bucket `listing-images`; `next.config.mjs` derives the allowed image host from `NEXT_PUBLIC_SUPABASE_URL`.
