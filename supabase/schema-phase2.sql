-- ============================================================================
--  J's Pickle Yard — Phase 2 schema (run AFTER schema.sql, in the SQL editor)
--  Moves the remaining content domain to Supabase: reviews, events,
--  notifications, site config (payment + contact), homepage gallery, and court
--  photos. Adds notification RPCs and a media/events storage bucket.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- courts: admin-uploaded photo override
-- ---------------------------------------------------------------------------
alter table public.courts add column if not exists photo text;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  rating     int not null check (rating between 1 and 5),
  text       text not null,
  status     text not null default 'published',  -- published | hidden
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- events (photos = array of storage URLs)
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  date        date not null,
  time        text default '',
  description text not null,
  photos      text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  message    text not null,
  type       text not null default 'info',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- site_config: single row (id = 1) — payment numbers/QRs + contact info
-- ---------------------------------------------------------------------------
create table if not exists public.site_config (
  id            int primary key default 1,
  gcash_number  text not null default '',
  bank_account  text not null default '',
  gcash_qr      text,
  bank_qr       text,
  address       text not null default '123 Sports Complex Ave., Quezon City, Metro Manila',
  phone         text not null default '0917 123 4567',
  email         text not null default 'hello@jspickleyard.com',
  socials       text not null default 'Facebook · Instagram · TikTok — @jspickleyard',
  note          text not null default 'Beside the main gym entrance — free parking for players.',
  constraint site_config_singleton check (id = 1)
);
insert into public.site_config (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- gallery: homepage slideshow slots 0..9 (url null = use default p{n}.jpg)
-- ---------------------------------------------------------------------------
create table if not exists public.gallery (
  slot int primary key check (slot between 0 and 9),
  url  text
);

-- ---------------------------------------------------------------------------
-- Notification RPCs (SECURITY DEFINER so they can insert across users)
-- ---------------------------------------------------------------------------
create or replace function public.add_notification(p_user uuid, p_msg text, p_type text default 'info')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, message, type) values (p_user, p_msg, p_type);
end; $$;

create or replace function public.add_admin_notification(p_msg text, p_type text default 'info')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, message, type)
  select id, p_msg, p_type from public.profiles where role = 'admin' and active;
end; $$;

create or replace function public.add_user_broadcast(p_msg text, p_type text default 'info')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, message, type)
  select id, p_msg, p_type from public.profiles where role = 'user' and active;
end; $$;

grant execute on function public.add_notification(uuid, text, text) to authenticated;
grant execute on function public.add_admin_notification(text, text) to authenticated;
grant execute on function public.add_user_broadcast(text, text) to authenticated;
-- The public Contacts form lets signed-out visitors message the admins.
grant execute on function public.add_admin_notification(text, text) to anon;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.reviews       enable row level security;
alter table public.events        enable row level security;
alter table public.notifications enable row level security;
alter table public.site_config   enable row level security;
alter table public.gallery       enable row level security;

-- reviews: published visible to all; users manage their own; admins manage all
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews
  for select using (status = 'published' or user_id = auth.uid() or public.is_admin());
drop policy if exists reviews_own_write on public.reviews;
create policy reviews_own_write on public.reviews
  for insert with check (user_id = auth.uid());
drop policy if exists reviews_own_update on public.reviews;
create policy reviews_own_update on public.reviews
  for update using (user_id = auth.uid() or public.is_admin());
drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- events: readable by everyone; writable by admins
drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (true);
drop policy if exists events_admin on public.events;
create policy events_admin on public.events for all
  using (public.is_admin()) with check (public.is_admin());

-- notifications: users read/update their own; admins read all
drop policy if exists notif_own_select on public.notifications;
create policy notif_own_select on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists notif_own_update on public.notifications;
create policy notif_own_update on public.notifications
  for update using (user_id = auth.uid());

-- site_config / gallery: readable by everyone; writable by admins
drop policy if exists siteconfig_read on public.site_config;
create policy siteconfig_read on public.site_config for select using (true);
drop policy if exists siteconfig_admin on public.site_config;
create policy siteconfig_admin on public.site_config for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists gallery_read on public.gallery;
create policy gallery_read on public.gallery for select using (true);
drop policy if exists gallery_admin on public.gallery;
create policy gallery_admin on public.gallery for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Harden bookings: users may no longer update booking rows directly. Proof
-- upload and self-cancel go through SECURITY DEFINER functions that only touch
-- the allowed columns (fixes the phase-1 over-broad update policy).
-- ---------------------------------------------------------------------------
drop policy if exists bookings_own_update on public.bookings;

create or replace function public.set_booking_proof(p_id uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set proof_url = p_url, proof_at = now()
  where id = p_id and user_id = auth.uid();
end; $$;

create or replace function public.cancel_booking_row(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bookings
    set status = 'cancelled', cancelled_at = now(),
        pay_status = case when pay_status = 'paid' then 'refunded' else pay_status end
  where id = p_id and user_id = auth.uid() and status = 'confirmed';
end; $$;

grant execute on function public.set_booking_proof(uuid, text) to authenticated;
grant execute on function public.cancel_booking_row(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: media bucket (court photos, QR codes, homepage gallery, event photos)
--   public read; only admins may upload/replace.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists media_admin_write on storage.objects;
create policy media_admin_write on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

drop policy if exists media_admin_update on storage.objects;
create policy media_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());

drop policy if exists media_admin_delete on storage.objects;
create policy media_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select using (bucket_id = 'media');
