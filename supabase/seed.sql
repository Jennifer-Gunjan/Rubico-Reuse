-- Demo data for the pilot demo. Run in the Supabase SQL editor AFTER you have signed in once and saved your profile.
-- Change the email below to the account that should own the demo items. Every demo row ends with "[demo]" so it can be removed (seed_remove.sql).
do $$
declare owner uuid;
begin
  select id into owner from profiles where email = 'jennifer.gunjan@rubicotech.in';
  if owner is null then raise exception 'No profile for that email. Sign in and save your profile first.'; end if;

  insert into listings (owner_id, title, description, category, condition, type, location, asking_price, negotiable, wanted_in_return, lend_duration_text) values
   (owner, 'Wooden study desk', 'Solid sheesham desk, one drawer. You collect. [demo]', 'Furniture', 'good', 'donate', 'Dehradun', null, false, null, null),
   (owner, 'Office chair', 'Ergonomic chair, gas lift works. [demo]', 'Furniture', 'good', 'sell', 'Haridwar', 1500, true, null, null),
   (owner, 'Python and data books (set of 4)', 'Clean copies, no markings. [demo]', 'Books', 'like_new', 'exchange', 'Dehradun', null, false, 'Any fiction or cooking books', null),
   (owner, 'Cordless drill with bits', 'Works well. Happy to lend for a weekend project. [demo]', 'Home and garden', 'good', 'lend', 'Haridwar', null, false, null, '1 week'),
   (owner, 'Kids bicycle, age 6 to 8', 'Outgrown. Needs new tyres. [demo]', 'Sports', 'fair', 'donate', 'Haridwar', null, false, null, null),
   (owner, 'Pressure cooker 5 litre', 'Steel, with spare gasket. [demo]', 'Kitchen', 'good', 'sell', 'Dehradun', 600, false, null, null),
   (owner, 'Winter jackets (2), size M', 'Barely worn. [demo]', 'Clothing', 'like_new', 'donate', 'Dehradun', null, false, null, null),
   (owner, 'Bluetooth speaker', 'Battery lasts about 6 hours. [demo]', 'Electronics', 'good', 'exchange', 'Haridwar', null, false, 'A power bank', null),
   (owner, 'Camping tent for 3', 'Used twice. Available to borrow for treks. [demo]', 'Sports', 'like_new', 'lend', 'Dehradun', null, false, null, '2 weeks'),
   (owner, 'Baby stroller', 'Foldable, in working order. [demo]', 'Kids and baby', 'good', 'donate', 'Haridwar', null, false, null, null),
   (owner, 'Monitor 22 inch', 'HDMI cable included. [demo]', 'Electronics', 'good', 'sell', 'Dehradun', 3500, true, null, null),
   (owner, 'Indoor plants (5 pots)', 'Money plant and snake plant. [demo]', 'Home and garden', 'good', 'donate', 'Dehradun', null, false, null, null);

  insert into wanted_posts (poster_id, title, description, category, location) values
   (owner, 'Looking for a standing fan', 'Any working fan, pedestal or table. [demo]', 'Electronics', 'Haridwar'),
   (owner, 'Need a bookshelf', 'Small, for a rented room. [demo]', 'Furniture', 'Dehradun'),
   (owner, 'Want a yoga mat', 'Any condition is fine. [demo]', 'Sports', 'Haridwar');
end $$;
