-- Rubico ReUse: schema, security rules and lifecycle functions.
-- Rule of the house: the database enforces trust. The app only calls the functions below.

-- ---------------------------------------------------------------- domain lock
create table allowed_domains (domain text primary key);
insert into allowed_domains values ('rubicotech.com'), ('rubicotech.in');
-- Keep in step with ALLOWED_DOMAINS in src/lib/domain.ts.

create function is_allowed_email(e text) returns boolean
language sql stable security definer set search_path = public as $$
  select trim(e) ~ '^[^@\s]+@[^@\s]+$'
     and exists (select 1 from allowed_domains where domain = lower(split_part(trim(e), '@', 2)));
$$;

create function enforce_domain() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_allowed_email(new.email) then
    raise exception 'Sign-in is limited to Rubico accounts';
  end if;
  return new;
end $$;

create trigger auth_users_domain before insert or update of email on auth.users
  for each row execute function enforce_domain();

-- ---------------------------------------------------------------- profiles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text not null default '',
  location text check (location in ('Haridwar', 'Dehradun')),
  teams_handle text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);
create trigger profiles_domain before insert or update of email on profiles
  for each row execute function enforce_domain();

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create function profile_complete(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                 where id = uid and location is not null
                   and trim(coalesce(teams_handle, '')) <> '' and trim(name) <> '');
$$;

-- ---------------------------------------------------------------- listings
create function can_transition(f text, t text, ty text) returns boolean
language sql immutable as $$
  select case
    when (f, t) in (('available','requested'), ('requested','requested'), ('requested','available'),
                    ('requested','accepted'), ('accepted','available'), ('available','closed'),
                    ('requested','closed'), ('closed','available')) then true
    when (f, t) = ('accepted', 'given') then ty <> 'lend'
    when (f, t) in (('accepted','lent'), ('lent','returned'), ('returned','available')) then ty = 'lend'
    else false
  end;
$$;
-- Mirrors canTransition in src/lib/transitions.ts.

create table listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles on delete cascade,
  title text not null check (length(trim(title)) between 3 and 100),
  description text not null check (length(trim(description)) between 1 and 2000),
  category text not null check (category in ('Furniture','Electronics','Books','Clothing','Kitchen',
                                             'Kids and baby','Sports','Home and garden','Other')),
  condition text not null check (condition in ('new','like_new','good','fair')),
  type text not null check (type in ('donate','exchange','sell','lend')),
  location text not null check (location in ('Haridwar','Dehradun')),
  asking_price numeric(10,2) check (asking_price >= 0),
  negotiable boolean not null default false,
  wanted_in_return text,
  lend_duration_text text,
  status text not null default 'available'
    check (status in ('available','requested','accepted','given','lent','returned','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type = 'sell') = (asking_price is not null)),
  check (type = 'sell' or negotiable = false),
  check (type = 'exchange' or wanted_in_return is null),
  check (type = 'lend' or lend_duration_text is null)
);
create index listings_live on listings (status, created_at desc);
create index listings_owner on listings (owner_id);

-- Direct status changes a giver may make from the app. Everything else
-- (request, accept, reject, withdraw, fall through, close) goes through the functions.
create function listings_guard() returns trigger language plpgsql as $$
declare
  sys boolean := coalesce(current_setting('reuse.system', true), '') = 'on';
begin
  if new.id <> old.id or new.owner_id <> old.owner_id or new.type <> old.type then
    raise exception 'This field cannot be changed';
  end if;

  if new.status <> old.status then
    if not can_transition(old.status, new.status, old.type) then
      raise exception 'Illegal status change: % to % for a % listing', old.status, new.status, old.type;
    end if;
    if not sys and (old.status, new.status) not in
       (('accepted','given'), ('accepted','lent'), ('lent','returned'), ('returned','available'), ('closed','available')) then
      raise exception 'Status change % to % is not allowed here', old.status, new.status;
    end if;
  end if;

  if not sys
     and old.status in ('accepted', 'lent', 'given')
     and (new.title, new.description, new.category, new.condition, new.location, new.asking_price,
          new.negotiable, new.wanted_in_return, new.lend_duration_text)
         is distinct from
         (old.title, old.description, old.category, old.condition, old.location, old.asking_price,
          old.negotiable, old.wanted_in_return, old.lend_duration_text) then
    raise exception 'A listing cannot be edited while it is %', old.status;
  end if;

  new.updated_at := now();
  return new;
end $$;
create trigger listings_guard before update on listings
  for each row execute function listings_guard();

create table listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings on delete cascade,
  storage_path text not null,
  position smallint not null check (position between 0 and 3),
  unique (listing_id, position)  -- positions 0..3 means at most 4 photos
);

-- ---------------------------------------------------------------- requests
create table requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings on delete cascade,
  seeker_id uuid not null references profiles on delete cascade,
  message text not null check (length(trim(message)) between 1 and 1000),
  offered_items text check (length(offered_items) <= 1000),
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','cancelled','withdrawn')),
  created_at timestamptz not null default now()
);
create unique index requests_one_active on requests (listing_id, seeker_id)
  where status in ('pending', 'accepted');
create unique index requests_one_accepted on requests (listing_id) where status = 'accepted';

create function requests_no_self() returns trigger language plpgsql as $$
begin
  if exists (select 1 from listings where id = new.listing_id and owner_id = new.seeker_id) then
    raise exception 'You cannot request your own listing';
  end if;
  return new;
end $$;
create trigger requests_no_self before insert on requests
  for each row execute function requests_no_self();

-- ---------------------------------------------------------------- notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  type text not null,
  ref_id uuid,
  message text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed','skipped')),
  email_attempts int not null default 0,
  created_at timestamptz not null default now()
);
create index notifications_user on notifications (user_id, created_at desc);

create function notify(p_user uuid, p_type text, p_ref uuid, p_msg text, p_payload jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, ref_id, message, payload) values (p_user, p_type, p_ref, p_msg, p_payload);
$$;

-- ---------------------------------------------------------------- wanted board, reports
create table wanted_posts (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references profiles on delete cascade,
  title text not null check (length(trim(title)) between 3 and 100),
  description text not null check (length(trim(description)) between 1 and 2000),
  category text not null check (category in ('Furniture','Electronics','Books','Clothing','Kitchen',
                                             'Kids and baby','Sports','Home and garden','Other')),
  location text not null check (location in ('Haridwar','Dehradun')),
  status text not null default 'open' check (status in ('open','fulfilled')),
  created_at timestamptz not null default now()
);

create table wanted_responses (
  id uuid primary key default gen_random_uuid(),
  wanted_id uuid not null references wanted_posts on delete cascade,
  responder_id uuid not null references profiles on delete cascade,
  note text check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (wanted_id, responder_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings on delete cascade,
  reporter_id uuid not null references profiles on delete cascade,
  reason text not null check (length(trim(reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

-- ---------------------------------------------------------------- lifecycle functions
-- Lock order is always: listing row first, then its requests. This avoids deadlocks.

create function create_request(p_listing uuid, p_message text, p_offered text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l listings; rid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not profile_complete(uid) then
    raise exception 'Complete your profile (location and Teams handle) first';
  end if;
  select * into l from listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.owner_id = uid then raise exception 'You cannot request your own listing'; end if;
  if l.status not in ('available', 'requested') then
    raise exception 'This listing is not accepting requests';
  end if;
  begin
    insert into requests (listing_id, seeker_id, message, offered_items)
    values (p_listing, uid, p_message, case when l.type = 'exchange' then nullif(trim(p_offered), '') end)
    returning id into rid;
  exception when unique_violation then
    raise exception 'You already have an active request on this listing';
  end;
  perform set_config('reuse.system', 'on', true);
  update listings set status = 'requested' where id = p_listing and status = 'available';
  perform set_config('reuse.system', 'off', true);
  perform notify(l.owner_id, 'new_request', rid, 'New request for "' || l.title || '"',
                 jsonb_build_object('listing_id', l.id, 'seeker_id', uid));
  return rid;
end $$;

create function withdraw_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lid uuid; l listings; r requests; remaining int;
begin
  select listing_id into lid from requests where id = p_request;
  if lid is null then raise exception 'Request not found'; end if;
  select * into l from listings where id = lid for update;
  select * into r from requests where id = p_request for update;
  if r.seeker_id is distinct from uid then raise exception 'This is not your request'; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be withdrawn'; end if;
  update requests set status = 'withdrawn' where id = p_request;
  select count(*) into remaining from requests where listing_id = lid and status = 'pending';
  if remaining = 0 and l.status = 'requested' then
    perform set_config('reuse.system', 'on', true);
    update listings set status = 'available' where id = lid;
    perform set_config('reuse.system', 'off', true);
  end if;
  perform notify(l.owner_id, 'request_withdrawn', p_request,
                 'A request for "' || l.title || '" was withdrawn (' || remaining || ' still pending)',
                 jsonb_build_object('listing_id', lid, 'seeker_id', uid, 'remaining', remaining));
end $$;

create function reject_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lid uuid; l listings; r requests; remaining int;
begin
  select listing_id into lid from requests where id = p_request;
  if lid is null then raise exception 'Request not found'; end if;
  select * into l from listings where id = lid for update;
  select * into r from requests where id = p_request for update;
  if l.owner_id is distinct from uid then raise exception 'Only the listing owner can do this'; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be rejected'; end if;
  update requests set status = 'rejected' where id = p_request;
  select count(*) into remaining from requests where listing_id = lid and status = 'pending';
  if remaining = 0 and l.status = 'requested' then
    perform set_config('reuse.system', 'on', true);
    update listings set status = 'available' where id = lid;
    perform set_config('reuse.system', 'off', true);
  end if;
  perform notify(r.seeker_id, 'request_rejected', p_request,
                 'Your request for "' || l.title || '" was not accepted',
                 jsonb_build_object('listing_id', lid));
end $$;

create function accept_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lid uuid; l listings; r requests; other record;
begin
  select listing_id into lid from requests where id = p_request;
  if lid is null then raise exception 'Request not found'; end if;
  select * into l from listings where id = lid for update;   -- the lock that makes one winner
  select * into r from requests where id = p_request for update;
  if l.owner_id is distinct from uid then raise exception 'Only the listing owner can do this'; end if;
  if l.status <> 'requested' then raise exception 'This listing has no open requests to accept'; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be accepted'; end if;
  update requests set status = 'accepted' where id = p_request;
  for other in
    update requests set status = 'rejected'
    where listing_id = lid and status = 'pending' and id <> p_request returning seeker_id, id
  loop
    perform notify(other.seeker_id, 'request_auto_rejected', other.id,
                   '"' || l.title || '" was reserved for someone else',
                   jsonb_build_object('listing_id', lid));
  end loop;
  perform set_config('reuse.system', 'on', true);
  update listings set status = 'accepted' where id = lid;
  perform set_config('reuse.system', 'off', true);
  perform notify(r.seeker_id, 'request_accepted', p_request,
                 'Your request for "' || l.title || '" was accepted',
                 jsonb_build_object('listing_id', lid, 'owner_id', l.owner_id));
end $$;

create function fall_through(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l listings; r requests;
begin
  select * into l from listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.owner_id is distinct from uid then raise exception 'Only the listing owner can do this'; end if;
  if l.status <> 'accepted' then raise exception 'Only an accepted listing can be marked as fallen through'; end if;
  update requests set status = 'cancelled' where listing_id = p_listing and status = 'accepted'
    returning * into r;
  perform set_config('reuse.system', 'on', true);
  update listings set status = 'available' where id = p_listing;
  perform set_config('reuse.system', 'off', true);
  if r.id is not null then
    perform notify(r.seeker_id, 'deal_fell_through', r.id,
                   '"' || l.title || '" is available again; you may request it again',
                   jsonb_build_object('listing_id', p_listing));
  end if;
end $$;

create function close_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l listings; other record;
begin
  select * into l from listings where id = p_listing for update;
  if not found then raise exception 'Listing not found'; end if;
  if l.owner_id is distinct from uid then raise exception 'Only the listing owner can do this'; end if;
  if l.status not in ('available', 'requested') then
    raise exception 'A listing can only be closed while it is available or requested';
  end if;
  for other in
    update requests set status = 'rejected' where listing_id = p_listing and status = 'pending'
    returning seeker_id, id
  loop
    perform notify(other.seeker_id, 'listing_closed', other.id,
                   'The giver closed "' || l.title || '"', jsonb_build_object('listing_id', p_listing));
  end loop;
  perform set_config('reuse.system', 'on', true);
  update listings set status = 'closed' where id = p_listing;
  perform set_config('reuse.system', 'off', true);
end $$;

create function respond_wanted(p_wanted uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); w wanted_posts;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not profile_complete(uid) then
    raise exception 'Complete your profile (location and Teams handle) first';
  end if;
  select * into w from wanted_posts where id = p_wanted;
  if not found then raise exception 'Wanted post not found'; end if;
  if w.poster_id = uid then raise exception 'You cannot respond to your own post'; end if;
  if w.status <> 'open' then raise exception 'This wanted post is already fulfilled'; end if;
  begin
    insert into wanted_responses (wanted_id, responder_id, note) values (p_wanted, uid, nullif(trim(p_note), ''));
  exception when unique_violation then
    raise exception 'You already responded to this post';
  end;
  perform notify(w.poster_id, 'wanted_response', p_wanted, 'Someone has "' || w.title || '"',
                 jsonb_build_object('responder_id', uid, 'note', nullif(trim(p_note), '')));
end $$;

-- ---------------------------------------------------------------- privacy: who can see what
-- Everyone sees name and location only. Email and Teams handle are visible to the other
-- party of an ACCEPTED request, and to yourself.
create view profile_cards as select id, name, location from profiles;

alter table profiles enable row level security;
create policy profiles_select on profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from requests r join listings l on l.id = r.listing_id
    where r.status = 'accepted'
      and ((r.seeker_id = auth.uid() and l.owner_id = profiles.id)
        or (l.owner_id = auth.uid() and r.seeker_id = profiles.id))
  )
);
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

alter table listings enable row level security;
create policy listings_select on listings for select to authenticated using (true);
create policy listings_insert on listings for insert to authenticated
  with check (owner_id = auth.uid() and status = 'available' and profile_complete(auth.uid()));
create policy listings_update on listings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table listing_images enable row level security;
create policy images_select on listing_images for select to authenticated using (true);
create policy images_insert on listing_images for insert to authenticated
  with check (exists (select 1 from listings where id = listing_id and owner_id = auth.uid()));
create policy images_delete on listing_images for delete to authenticated
  using (exists (select 1 from listings where id = listing_id and owner_id = auth.uid()));

alter table requests enable row level security;
create policy requests_select on requests for select to authenticated using (
  seeker_id = auth.uid()
  or exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid())
);

alter table notifications enable row level security;
create policy notifications_select on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table wanted_posts enable row level security;
create policy wanted_select on wanted_posts for select to authenticated using (true);
create policy wanted_insert on wanted_posts for insert to authenticated
  with check (poster_id = auth.uid() and status = 'open' and profile_complete(auth.uid()));
create policy wanted_update on wanted_posts for update to authenticated
  using (poster_id = auth.uid()) with check (poster_id = auth.uid());

alter table wanted_responses enable row level security;
create policy wresp_select on wanted_responses for select to authenticated using (
  responder_id = auth.uid()
  or exists (select 1 from wanted_posts w where w.id = wanted_id and w.poster_id = auth.uid())
);

alter table reports enable row level security;
create policy reports_select on reports for select to authenticated using (reporter_id = auth.uid());
create policy reports_insert on reports for insert to authenticated with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------- grants (least privilege)
revoke all on profiles, listings, listing_images, requests, notifications, wanted_posts,
              wanted_responses, reports, allowed_domains, profile_cards from anon, authenticated;
grant select on profiles, listings, listing_images, requests, notifications, wanted_posts,
                wanted_responses, reports, profile_cards to authenticated;
grant update (name, location, teams_handle) on profiles to authenticated;       -- not role, not email
grant insert on listings, listing_images, wanted_posts, reports to authenticated;
grant update (title, description, category, condition, location, asking_price, negotiable,
              wanted_in_return, lend_duration_text, status) on listings to authenticated;
grant delete on listing_images to authenticated;
grant update (read_at) on notifications to authenticated;
grant update (status) on wanted_posts to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function create_request, withdraw_request, reject_request, accept_request,
  fall_through, close_listing, respond_wanted, profile_complete to authenticated;
grant usage on schema public to authenticated;
