-- The Slack contact is the product's actual deliverable: after a giver accepts, this value is
-- emailed to the matched colleague as the way to reach them (src/lib/outbox.ts). Nothing
-- downstream can tell that "not-an-email-at-all-!!!" is unreachable, so the hand-over fails
-- in silence. It was unvalidated at every layer: the form asked only that it be non-empty,
-- the server checked the same, and the column had no constraint at all.
--
-- The rule is deliberately permissive, because the product disagrees with itself about this
-- field. The column is `teams_handle` and the fixtures store handles like '@alice', but the
-- form labels it "Slack email" and suggests name@rubicotech.com. Both forms are a real way
-- to reach someone on Slack, so both are accepted. What this rejects is text that cannot be
-- a contact at all: embedded spaces, punctuation, a bare '@'.
--
-- Tighten to addresses only once the product owner confirms which the field is meant to be.

do $$
declare bad int;
begin
  select count(*) into bad from profiles
  where teams_handle is not null
    and teams_handle !~ '^(@?[A-Za-z0-9._-]{2,}|[^@\s]+@[^@\s]+\.[^@\s]+)$';
  if bad > 0 then
    raise warning 'teams_handle: % existing profile(s) are not usable contacts; they are left as they are and will be corrected on next save', bad;
  end if;
end $$;

-- NOT VALID leaves existing rows alone: people are prompted to fix theirs on next save
-- rather than being locked out of a profile they cannot update.
alter table profiles
  add constraint profiles_teams_handle_format
  check (teams_handle is null
         or teams_handle ~ '^(@?[A-Za-z0-9._-]{2,}|[^@\s]+@[^@\s]+\.[^@\s]+)$') not valid;
