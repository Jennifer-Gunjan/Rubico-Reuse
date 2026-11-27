-- A listing stays editable while people are queued for it.
--
-- The edit lock covers 'accepted', 'lent' and 'given', but not 'requested'. So an owner can
-- raise the price or rewrite the description after colleagues have asked for the item, and
-- those colleagues were never told. Between colleagues in one company that is a trust
-- problem more than a technical one: someone asks for a desk at 500 and turns up to find it
-- is now 2000.
--
-- Editing while people are waiting is legitimate - a typo, a better photo, a corrected
-- condition - so this tells them rather than forbidding it. A trigger rather than app code,
-- because the rule should hold however the row is updated.

create function notify_requesters_of_edit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
  changed text[] := '{}';
  summary text;
begin
  if old.status <> 'requested' then return new; end if;

  -- The price is called out separately, with both figures: it is the change most likely to
  -- matter to someone who has already committed to asking.
  if new.asking_price is distinct from old.asking_price then
    changed := array_append(changed, 'the price is now ' ||
      case when new.asking_price is null then 'not set'
           else '₹' || trim(to_char(new.asking_price, 'FM999999990.00')) end);
  end if;
  if new.title is distinct from old.title then changed := array_append(changed, 'the title changed'); end if;
  if new.description is distinct from old.description then changed := array_append(changed, 'the description changed'); end if;
  if new.condition is distinct from old.condition then changed := array_append(changed, 'the condition changed'); end if;
  if new.location is distinct from old.location then changed := array_append(changed, 'the city changed'); end if;
  if new.wanted_in_return is distinct from old.wanted_in_return then changed := array_append(changed, 'what they want in return changed'); end if;
  if (new.category, new.negotiable, new.lend_duration_text)
     is distinct from (old.category, old.negotiable, old.lend_duration_text) then
    changed := array_append(changed, 'the details changed');
  end if;

  if cardinality(changed) = 0 then return new; end if;
  summary := array_to_string(changed, ', ');

  for r in select seeker_id from requests where listing_id = new.id and status = 'pending' loop
    perform notify(r.seeker_id, 'listing_edited', new.id,
                   '"' || new.title || '" was changed after you asked for it: ' || summary,
                   jsonb_build_object('listing_id', new.id));
  end loop;
  return new;
end $$;

create trigger listings_notify_edit after update on listings
  for each row execute function notify_requesters_of_edit();
