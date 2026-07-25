-- ============================================================================
--  Location coordinates + landmark photo — run in the Supabase SQL editor.
--  Lets the admin set the exact map pin and an optional landmark image.
-- ============================================================================
alter table public.site_config
  add column if not exists map_lat text not null default '7.045760737335788',
  add column if not exists map_lng text not null default '125.52425272530164',
  add column if not exists landmark_image text;

notify pgrst, 'reload schema';
