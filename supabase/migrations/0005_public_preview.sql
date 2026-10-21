-- Read-only public preview of live listings (available or requested). No giver identity, no contact details, no requests.
-- Views run with their owner's rights, so they bypass row-level security on purpose and expose only the columns below.
create view public_listings as
  select id, title, description, category, condition, type, location, asking_price, negotiable,
         wanted_in_return, lend_duration_text, status, created_at
  from listings where status in ('available', 'requested');

create view public_listing_images as
  select i.listing_id, i.storage_path, i.position
  from listing_images i join listings l on l.id = i.listing_id
  where l.status in ('available', 'requested');

-- Supabase hands new objects to anon and authenticated with full rights, and a simple view is updatable: lock it down to SELECT.
revoke all on public_listings, public_listing_images from public, anon, authenticated;
grant select on public_listings, public_listing_images to anon, authenticated;
