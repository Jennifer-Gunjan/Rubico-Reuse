-- A colleague who answers "I have this" was never told the outcome.
--
-- Marking a wanted post fulfilled was a bare status flag: no notification to anyone who had
-- responded, not even "someone else provided it". The listings side notifies on accept,
-- reject, auto-reject, close and fall-through; the wanted board notified nobody outward.
-- For a feature where colleagues go out of their way to help, silence is the surest way to
-- stop them bothering.
--
-- A trigger rather than app code, because `authenticated` holds grant update (status) on
-- wanted_posts, so the status can be set without going through the app at all.

create function notify_wanted_responders() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if old.status = 'open' and new.status = 'fulfilled' then
    for r in select responder_id from wanted_responses where wanted_id = new.id loop
      perform notify(r.responder_id, 'wanted_fulfilled', new.id,
                     'The colleague who asked for "' || new.title || '" has found one',
                     jsonb_build_object('wanted_id', new.id));
    end loop;
  end if;
  return new;
end $$;

create trigger wanted_posts_notify_fulfilled after update of status on wanted_posts
  for each row execute function notify_wanted_responders();
