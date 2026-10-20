import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Minimal stand-ins for the parts of Supabase our migrations touch.
const SUPABASE_STUB = `
create schema auth; create schema storage;
create role anon; create role authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), email text,
  raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;
grant usage on schema auth, storage to anon, authenticated;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(__dirname, "../../supabase/migrations");
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  return db;
}

export type Db = Awaited<ReturnType<typeof freshDb>>;

/** Sign up a Rubico user (as the auth service would) and complete their profile. */
export async function mkUser(db: Db, email: string, name = email.split("@")[0]) {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`, [email]);
  const id = rows[0].id;
  await db.query(
    `update profiles set name = $2, location = 'Haridwar', teams_handle = $3 where id = $1`,
    [id, name, `@${name}`]);
  return id;
}

/** Run a callback as a signed-in user, with row-level security active. */
export async function as<T>(db: Db, uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

export async function mkListing(db: Db, owner: string, type = "donate", title = "Study table") {
  return as(db, owner, async () => {
    const price = type === "sell" ? "100" : "null";
    const wanted = type === "exchange" ? "'a lamp'" : "null";
    const dur = type === "lend" ? "'one week'" : "null";
    const { rows } = await db.query<{ id: string }>(
      `insert into listings (owner_id, title, description, category, condition, type, location,
         asking_price, wanted_in_return, lend_duration_text)
       values ($1, $2, 'Solid wood', 'Furniture', 'good', $3, 'Haridwar', ${price}, ${wanted}, ${dur})
       returning id`, [owner, title, type]);
    return rows[0].id;
  });
}

export const status = async (db: Db, listing: string) =>
  (await db.query<{ status: string }>(`select status from listings where id = $1`, [listing])).rows[0].status;
