-- ============================================================================
--  Privacy fix — run in the Supabase SQL editor.
--  court_occupancy previously returned user_id, letting any anonymous caller
--  enumerate which user UUID holds which slot. It now returns an is_mine flag
--  computed server-side from auth.uid(), exposing no user IDs.
--  (The return type changes, so we drop-then-recreate.)
-- ============================================================================
drop function if exists public.court_occupancy(date, text);

create or replace function public.court_occupancy(p_date date, p_court text)
returns table (start_hour int, end_hour int, is_mine boolean)
language sql
security definer set search_path = public
as $$
  select start_hour, end_hour, (user_id = auth.uid()) as is_mine
  from public.bookings
  where date = p_date and court_id = p_court and status = 'confirmed';
$$;

notify pgrst, 'reload schema';
