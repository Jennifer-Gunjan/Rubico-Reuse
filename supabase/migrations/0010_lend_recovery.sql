-- A lent item that is never returned had no way out.
--
-- From 'lent' the only legal move was 'returned'. An owner whose borrower left the company
-- or simply never gave the item back could not relist it, could not close it, and could not
-- even edit the title to warn colleagues, because the edit lock covers 'lent'. Their only
-- exit was to mark it Returned, which is untrue, and which erased the failure from the
-- record entirely: every loan looked like it had ended well.
--
-- This adds an honest exit. The owner records what happened, the listing becomes available
-- again, and the note is readable ONLY by the owner.

-- 1. Allow the move. Mirrored in src/lib/transitions.ts.
create or replace function can_transition(f text, t text, ty text) returns boolean
language sql immutable as $$
  select case
    when (f, t) in (('available','requested'), ('requested','requested'), ('requested','available'),
                    ('requested','accepted'), ('accepted','available'), ('available','closed'),
                    ('requested','closed'), ('closed','available')) then true
    when (f, t) = ('accepted', 'given') then ty <> 'lend'
    when (f, t) in (('accepted','lent'), ('lent','returned'), ('returned','available'),
                    ('lent','available')) then ty = 'lend'
    else false
  end;
$$;

-- 2. The record. A separate table rather than a column on listings, because every signed-in
--    colleague may read every listings row (listings_select uses true), so a column there
--    would not be private. Here the policy restricts it to the owner.
create table lend_recoveries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings on delete cascade,
  owner_id uuid not null references profiles on delete cascade,
  borrower_id uuid references profiles on delete set null,
  reason text not null check (length(trim(reason)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index lend_recoveries_owner on lend_recoveries (owner_id, created_at desc);
create index lend_recoveries_listing on lend_recoveries (listing_id);

alter table lend_recoveries enable row level security;
create policy lend_recoveries_select on lend_recoveries for select to authenticated
  using (owner_id = auth.uid());

-- Supabase grants new objects broadly: lock it to reads by the owner, writes only via the
-- function below.
revoke all on lend_recoveries from public, anon, authenticated;
grant select on lend_recoveries to authenticated;

-- 3. The one way to perform it, so the record and the status change cannot come apart.
create function recover_lent(p_listing uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l listings; r requests; note text := trim(coalesce(p_reason, ''));
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if note = '' then raise exception 'Say briefly what happened, so you have a record of it'; end if;
  if length(note) > 1000 then raise exception 'Keep the note under 1000 characters'; end if;

  select * into l from listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.owner_id is distinct from uid then raise exception 'Only the listing owner can do this'; end if;
  if l.status <> 'lent' then raise exception 'Only a lent item can be recorded as not returned'; end if;

  update requests set status = 'cancelled'
    where listing_id = p_listing and status = 'accepted' returning * into r;

  insert into lend_recoveries (listing_id, owner_id, borrower_id, reason)
    values (p_listing, uid, r.seeker_id, note);

  perform set_config('reuse.system', 'on', true);
  update listings set status = 'available' where id = p_listing;
  perform set_config('reuse.system', 'off', true);

  -- The borrower is told the loan was closed, but never the note: that is the owner's record,
  -- not a message. Saying nothing at all would leave someone who simply forgot with no signal.
  if r.id is not null then
    perform notify(r.seeker_id, 'lend_recovered', p_listing,
                   'The lender marked "' || l.title || '" as not returned',
                   jsonb_build_object('listing_id', p_listing));
  end if;
end $$;

revoke execute on function recover_lent(uuid, text) from public, anon;
grant execute on function recover_lent(uuid, text) to authenticated;
