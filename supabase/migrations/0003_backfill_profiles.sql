-- Accounts created before the signup trigger existed have no profile row. Create the missing ones.
insert into profiles (id, email, name)
select id, email, split_part(email, '@', 1) from auth.users
where id not in (select id from profiles) and public.is_allowed_email(email);
