-- ============================================================================
--  Weekend pricing — run in the Supabase SQL editor (after the earlier schemas)
--  Adds a separate weekend rate. Existing weekday rate stays in price_per_hour.
-- ============================================================================
alter table public.settings
  add column if not exists weekend_price_per_hour int not null default 250;

-- Refresh the API so the new column is exposed immediately.
notify pgrst, 'reload schema';
