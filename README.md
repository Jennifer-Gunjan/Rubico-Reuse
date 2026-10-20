# Rubico ReUse

Internal marketplace for Rubico employees to donate, exchange, sell and lend items. Access is limited to @rubicotech.com and @rubicotech.in accounts.

## Run
```
cp .env.example .env.local   # fill Supabase URL + anon key
npm ci && npm run dev
```

## Checks (also run in CI)
`npm run lint && npm run typecheck && npm test && npm run build`

## Database
Apply `supabase/migrations/*.sql` in order (Supabase SQL editor or `supabase db push`). Rules (RLS, transitions, domain lock) live in the database and are tested in `tests/db` with in-process Postgres.

## Env vars
See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is server-only; never commit secrets.
