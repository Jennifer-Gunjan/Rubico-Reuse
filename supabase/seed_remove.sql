-- Removes everything created by seed.sql (rows whose description ends with "[demo]").
delete from listings where description like '%[demo]';
delete from wanted_posts where description like '%[demo]';
