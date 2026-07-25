-- ============================================================================
--  Event start/end times — run in the Supabase SQL editor.
--  Lets events have a real start and end time so status can be
--  Upcoming / Happening now / Finished based on the venue clock.
-- ============================================================================
alter table public.events
  add column if not exists start_time text,
  add column if not exists end_time text;

notify pgrst, 'reload schema';
