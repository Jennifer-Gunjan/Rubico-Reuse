-- Indexes for the two hottest reads and the four unindexed foreign keys.
-- Pure additions: no behaviour, data or policy changes. Measured on a local Supabase
-- seeded to 20,003 listings, 60,000 requests and 100,000 notifications.

-- 1. The listing page reads a listing's requests of ALL statuses:
--      from("requests").select(...).eq("listing_id", id)
--    requests_one_active and requests_one_accepted are both PARTIAL indexes limited to
--    active statuses, so neither can serve that read and Postgres scanned the whole table.
--      before: Seq Scan, 59,997 rows removed by filter to return 3   6.86 ms
--      after:  Index Scan                                            0.086 ms   (~80x)
--    The cost scaled with the global requests table, not the listing, so every listing
--    view by every user paid it.
create index requests_listing on requests (listing_id);

-- 2. Browse reads the public view, which filters two statuses and orders by date:
--      where status in ('available','requested') order by created_at desc limit 60
--    listings_live is (status, created_at desc); with two status values the index cannot
--    be walked in date order, so every matching row was collected and top-N sorted.
--      before: Bitmap Heap Scan + top-N heapsort over 10,003 rows    9.53 ms
--      after:  Index Scan, no sort node at all                       0.087 ms   (~109x)
--    This also changes the shape: O(live listings) becomes O(limit).
create index listings_live_created on listings (created_at desc)
  where status in ('available', 'requested');

-- 3. Postgres does not index foreign keys automatically. These four had no index with the
--    column leading, so every delete from auth.users cascaded into four sequential scans.
--    That is the employee-leaves path, the one deletion this product actually performs.
--    seeker_id and poster_id also back ordinary reads ("my requests", the wanted board).
create index requests_seeker on requests (seeker_id);
create index wanted_posts_poster on wanted_posts (poster_id);
create index wanted_responses_responder on wanted_responses (responder_id);
create index reports_reporter on reports (reporter_id);
