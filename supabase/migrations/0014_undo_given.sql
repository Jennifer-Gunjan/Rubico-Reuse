-- "Given" was terminal and irreversible. One misclick permanently ended a listing, with no
-- undo and no admin override. Marking an item given is a single button next to "Deal fell
-- through", and the two mean opposite things.
--
-- Permanent is defensible; permanent-by-accident is not. This adds a correction window
-- rather than full reversibility: the owner may take it back shortly after, and after that
-- it stays final.
--
-- The window is measured from updated_at, which listings_guard sets on every write. While a
-- listing is given it cannot be edited, so updated_at is the moment it became given.

-- How long an owner has to undo. Long enough to notice a misclick the same day, short enough
-- that a completed hand-over stops being reversible.
create function undo_given_window() returns interval language sql immutable as $$
  select interval '24 hours';
$$;

-- Allow the move. Lend listings never reach 'given', so it is for the other three types.
create or replace function can_transition(f text, t text, ty text) returns boolean
language sql immutable as $$
  select case
    when (f, t) in (('available','requested'), ('requested','requested'), ('requested','available'),
                    ('requested','accepted'), ('accepted','available'), ('available','closed'),
                    ('requested','closed'), ('closed','available')) then true
    when (f, t) = ('accepted', 'given') then ty <> 'lend'
    when (f, t) = ('given', 'accepted') then ty <> 'lend'
    when (f, t) in (('accepted','lent'), ('lent','returned'), ('returned','available'),
                    ('lent','available')) then ty = 'lend'
    else false
  end;
$$;

-- listings_guard still refuses given -> accepted from a direct update, because it is not in
-- the list a giver may make by hand. Only this function, which sets the system flag, can do
-- it - so the window cannot be sidestepped by writing to the table.
create function undo_given(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l listings;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into l from listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.owner_id is distinct from uid then raise exception 'Only the listing owner can do this'; end if;
  if l.status <> 'given' then raise exception 'Only an item marked as given can be put back'; end if;
  if l.updated_at < now() - undo_given_window() then
    raise exception 'This item was marked as given more than a day ago, so it can no longer be put back';
  end if;

  -- The accepted request was never changed when the item was marked given, so flipping the
  -- listing back is enough: the same two people are still matched.
  perform set_config('reuse.system', 'on', true);
  update listings set status = 'accepted' where id = p_listing;
  perform set_config('reuse.system', 'off', true);
end $$;

revoke execute on function undo_given(uuid), undo_given_window() from public, anon;
grant execute on function undo_given(uuid) to authenticated;
