-- A wanted-post poster may see the profile of anyone who responded "I have this" (requirements F03).
drop policy profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from requests r join listings l on l.id = r.listing_id
    where r.status = 'accepted'
      and ((r.seeker_id = auth.uid() and l.owner_id = profiles.id)
        or (l.owner_id = auth.uid() and r.seeker_id = profiles.id))
  )
  or exists (
    select 1 from wanted_responses wr join wanted_posts w on w.id = wr.wanted_id
    where w.poster_id = auth.uid() and wr.responder_id = profiles.id
  )
);
