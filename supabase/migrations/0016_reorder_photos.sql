-- Choosing which photo is the cover, when editing.
--
-- The cover is whichever photo sits in the lowest position, and PhotoPicker already offers
-- "Make cover" when posting. Editing could not: promoting an uploaded photo means changing
-- position values, and `unique (listing_id, position)` with `check (position between 0 and 3)`
-- leaves no spare slot to swap through. A plain swap fails on the unique index mid-statement.
--
-- Making the constraint deferrable lets one statement renumber every row and have uniqueness
-- checked once, at the end, when the arrangement is valid again. It stays INITIALLY IMMEDIATE,
-- so ordinary inserts and updates behave exactly as before; only this function defers it.
--
-- Renumbering also closes the root cause behind the Browse cover bug. #43 fixed the symptom
-- by reading the lowest position; this makes positions contiguous from 0 again after a
-- delete, so "the first photo is the cover" becomes true once more rather than merely
-- tolerated.

alter table listing_images drop constraint listing_images_listing_id_position_key;
alter table listing_images add constraint listing_images_listing_id_position_key
  unique (listing_id, position) deferrable initially immediate;

create function reorder_listing_photos(p_listing uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l listings; held int;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into l from listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.owner_id is distinct from uid then raise exception 'Only the listing owner can do this'; end if;

  -- The list must be exactly this item's photos: no gaps, no strangers, no duplicates.
  -- Otherwise a caller could renumber one photo and leave the rest colliding.
  select count(*) into held from listing_images where listing_id = p_listing;
  if held <> cardinality(p_ids) then
    raise exception 'That is not the full set of photos for this item';
  end if;
  if (select count(distinct id) from unnest(p_ids) as id) <> cardinality(p_ids) then
    raise exception 'The same photo was listed twice';
  end if;
  if exists (
    select 1 from unnest(p_ids) as wanted(id)
    where not exists (select 1 from listing_images li where li.id = wanted.id and li.listing_id = p_listing)
  ) then
    raise exception 'Those photos do not belong to this item';
  end if;

  set constraints listing_images_listing_id_position_key deferred;
  update listing_images li
     set position = ordered.ord - 1
    from unnest(p_ids) with ordinality as ordered(id, ord)
   where li.id = ordered.id;
end $$;

revoke execute on function reorder_listing_photos(uuid, uuid[]) from public, anon;
grant execute on function reorder_listing_photos(uuid, uuid[]) to authenticated;
