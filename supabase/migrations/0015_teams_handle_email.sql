-- The Slack contact is now an email address, confirmed by the product owner.
--
-- 0009 accepted either an address or a handle, because the product disagreed with itself:
-- the column is `teams_handle` and fixtures stored "@alice", but the form says "Slack email"
-- and suggests name@rubicotech.com. That has now been settled - it is an address - so the
-- rule tightens to match what the form has always asked for.
--
-- This value is emailed to a matched colleague as the way to reach them, so "asha" being
-- rejected is the point: a handle is not something the recipient can write to.

alter table profiles drop constraint if exists profiles_teams_handle_format;

-- Still NOT VALID. Anyone whose stored value is a handle keeps their account working and is
-- asked for an address the next time they save, rather than being locked out of a profile
-- they cannot edit. Validate it later, once the warning below reports zero.
alter table profiles
  add constraint profiles_teams_handle_format
  check (teams_handle is null or teams_handle ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') not valid;

do $$
declare stale int;
begin
  select count(*) into stale from profiles
  where teams_handle is not null and teams_handle !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  if stale > 0 then
    raise warning 'teams_handle: % profile(s) still hold a handle rather than an address. They keep working and will be corrected on next save. Run: select email from profiles where teams_handle !~ ''^[^@\s]+@[^@\s]+\.[^@\s]+$'';', stale;
  end if;
end $$;
