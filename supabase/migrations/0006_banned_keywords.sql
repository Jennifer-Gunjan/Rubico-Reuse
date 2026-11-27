-- Moderation enforced in the database, not only in the screens.
--
-- Until now the banned-item rule lived only in src/lib/banned.ts, reached through
-- validateListing / validateWanted. The app paths are correct, but `authenticated`
-- holds a direct insert grant on listings and wanted_posts, so a signed-in employee
-- posting straight to PostgREST with the publishable key bypassed the check entirely
-- and the item appeared on the signed-out Browse page. (BUG-003)
--
-- This mirrors the allowed_domains pattern already used for the sign-in domain lock:
-- a table the product owner can edit, a function, and a trigger. Keeping the list in
-- a table matters because docs/RELEASE_NOTES.md records that the word list is still
-- provisional and awaiting the product owner's confirmation -- that should not need
-- a code release. src/lib/banned.ts stays as the fast, friendly message in the form.

create table banned_keywords (word text primary key);
-- Keep in step with BANNED in src/lib/banned.ts.
-- Bare "gun", "tablet" and "knife" are left out on purpose: glue guns, tablets and
-- kitchen knives are fine.
insert into banned_keywords (word) values
  ('medicine'), ('medicines'), ('medication'), ('medications'),
  ('antibiotic'), ('antibiotics'), ('painkiller'), ('painkillers'), ('prescription'),
  ('weapon'), ('weapons'), ('firearm'), ('firearms'),
  ('pistol'), ('pistols'), ('revolver'), ('rifle'), ('rifles'), ('shotgun'),
  ('ammunition'), ('explosive'), ('explosives');

-- Returns the first banned word found, or null. \y is a word boundary, so "gunpowder"
-- does not match "gun" and "medicines" is matched by its own entry, exactly as the
-- \b(...)\b regex in src/lib/banned.ts behaves.
create function has_banned_keyword(t text) returns text
language sql stable security definer set search_path = public as $$
  select word from banned_keywords
  where t ~* ('\y' || word || '\y')
  order by word
  limit 1;
$$;

-- One trigger function for both tables: to_jsonb(new) lets it read wanted_in_return
-- on listings without failing on wanted_posts, which has no such column.
create function enforce_not_banned() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new);
  hit text;
begin
  hit := has_banned_keyword(
    coalesce(j ->> 'title', '') || ' ' ||
    coalesce(j ->> 'description', '') || ' ' ||
    coalesce(j ->> 'wanted_in_return', ''));
  if hit is not null then
    raise exception '"%" items cannot be listed on Rubico ReUse', hit
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger listings_not_banned
  before insert or update of title, description, wanted_in_return on listings
  for each row execute function enforce_not_banned();

create trigger wanted_posts_not_banned
  before insert or update of title, description on wanted_posts
  for each row execute function enforce_not_banned();

-- Supabase hands new objects to anon and authenticated with full rights: lock it down.
-- The list itself is not readable by users, matching how allowed_domains is treated.
revoke all on banned_keywords from public, anon, authenticated;
revoke execute on function has_banned_keyword(text), enforce_not_banned() from public, anon;
