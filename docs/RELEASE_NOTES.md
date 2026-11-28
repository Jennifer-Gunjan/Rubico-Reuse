# Rubico ReUse v1.0 release notes (Fri 23 Oct 2026)

## What it does
Rubico colleagues in Haridwar and Dehradun donate, exchange, sell and lend items, post "wanted" requests, and arrange hand-over after the giver accepts a request.

- **Public preview:** landing page, Browse and listing pages are readable without login (live items only, no giver identity or contact details, not indexed by search engines).
- **Sign-in:** Google, or an emailed link. Only @rubicotech.com and @rubicotech.in accounts get in, enforced in the app and in the database.
- **First login:** an incomplete profile (name, city, Slack email) is completed before anything else, then the person continues where they were heading.
- **Listings:** up to several photos, categories, condition, four types (donate, exchange, sell, lend), edit, close.
- **Requests:** one active request per person per item, one accepted winner, withdraw, reject, fall-through to the next requester.
- **Wanted board:** post what you need; colleagues respond with "I have this".
- **Contact details** (name, email, Slack email) are shared only between the two matched people, in the app and in the acceptance email.
- **Notifications:** in-app, plus email over SMTP with automatic retry (3 attempts, daily retry job).
- **Safety:** banned-item keyword filter, report-a-listing to the product owner.

## Quality evidence
- 279 automated unit, API and database tests; 4 concurrency tests on real Postgres; 6 live API tests; browser tests including a two-account journey and accessibility checks (axe). All green on `main` in CI at last merge.
- Phone layout checked at 375px; contrast checked against WCAG AA.

## Known limits (accepted for v1)
- Gmail SMTP sender: about 500 emails a day, may reach spam at first.
- Supabase sign-in email link is rate limited on the built-in sender; use Google sign-in for UAT.
- No admin screen, chat, ratings, payments, maps, image resizing.
- Typing into a form before the page finishes loading can clear fields (rare; fix available).
- Listing text and photos are public on the internet by decision of 21 Oct (scope change from employees-only).

## Before real use
1. Merge PR #22, add `SMTP_USER` / `SMTP_PASS` in Vercel, send one test notification.
2. Apply migrations 0001 to 0005 (done up to 0004 earlier; 0005 for the preview).
3. Add UAT colleagues as Google test users if the consent screen is External.
4. Confirm Supabase backup plan; take the first dump. (The banned-word list is confirmed and now lives in the `banned_keywords` table, so changing it needs no release.)
5. Delete `[E2E]` and demo data: `delete from listings where title like '[E2E]%';` and `supabase/seed_remove.sql`.

## Rollback
Vercel, Deployments, promote the previous Production deployment. Database changes are additive, so no data rollback is needed.
