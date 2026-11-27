-- The admin role was never built. No screen exposes it, no policy grants it anything, and
-- moderation is done by hand in the Supabase console (docs/HANDOVER.md). Column-level grants
-- already exclude `role` from what a user may update, so nobody could ever hold it.
--
-- An unused privilege level is a liability rather than a feature: it reads as though an
-- admin tier exists and is enforced somewhere, which invites someone to rely on it. Removing
-- it makes the absence explicit. If an admin tier is wanted later it should arrive together
-- with the policies and screens that give it meaning.

-- Refuse to run rather than silently discard a privilege someone granted by hand.
do $$
begin
  if exists (select 1 from profiles where role is distinct from 'user') then
    raise exception 'A profile holds a non-user role. Resolve that before dropping the column.';
  end if;
end $$;

alter table profiles drop column role;
