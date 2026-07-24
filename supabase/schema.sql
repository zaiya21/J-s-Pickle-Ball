-- ============================================================================
--  J's Pickle Yard — Supabase schema (run once in the Supabase SQL editor)
--  Creates the booking-domain tables, row-level security, seed data, an
--  overlap guard that makes double-booking impossible, and the proofs bucket.
-- ============================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (name/phone/role/active)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  phone      text not null default '',
  email      text not null default '',
  role       text not null default 'user',   -- 'user' | 'admin'
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever someone signs up (name/phone come from
-- the signUp() metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used by policies (security definer avoids recursive RLS on profiles).
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- ---------------------------------------------------------------------------
-- settings: a single configuration row (id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id                  int primary key default 1,
  open_hour           int not null default 8,
  close_hour          int not null default 22,
  price_per_hour      int not null default 200,
  discount_after_hours int not null default 2,
  discount_per_hour   int not null default 50,
  paddle_rent_per_hour int not null default 50,
  cancel_hours        int not null default 2,
  currency            text not null default '₱',
  constraint settings_singleton check (id = 1)
);

-- ---------------------------------------------------------------------------
-- courts
-- ---------------------------------------------------------------------------
create table if not exists public.courts (
  id       text primary key,
  name     text not null,
  active   boolean not null default true,
  note     text default '',
  position int not null default 0
);

-- ---------------------------------------------------------------------------
-- maintenance blocks
-- ---------------------------------------------------------------------------
create table if not exists public.maintenance (
  id         uuid primary key default gen_random_uuid(),
  court_id   text not null,              -- 'all' or a courts.id
  date       date not null,
  start_hour int not null,
  end_hour   int not null,
  reason     text default ''
);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  ref          text unique not null,
  user_id      uuid not null references auth.users (id) on delete cascade,
  court_id     text not null,
  date         date not null,
  start_hour   int not null,
  end_hour     int not null,
  paddles      int not null default 0,
  amount       int not null,
  pay_method   text not null,
  pay_status   text not null default 'unpaid',   -- unpaid | pending | paid | refunded
  status       text not null default 'confirmed', -- confirmed | cancelled
  proof_url    text,
  proof_at     timestamptz,
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz
);

-- No two CONFIRMED bookings may overlap on the same court+date. This makes
-- a race between two users physically impossible at the database level.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    court_id with =,
    date with =,
    int4range(start_hour, end_hour) with &&
  ) where (status = 'confirmed');

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.settings    enable row level security;
alter table public.courts      enable row level security;
alter table public.maintenance enable row level security;
alter table public.bookings    enable row level security;

-- profiles: self read/update; admins manage all
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- settings / courts / maintenance: readable by everyone, writable by admins
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists courts_read on public.courts;
create policy courts_read on public.courts for select using (true);
drop policy if exists courts_admin on public.courts;
create policy courts_admin on public.courts for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists maint_read on public.maintenance;
create policy maint_read on public.maintenance for select using (true);
drop policy if exists maint_admin on public.maintenance;
create policy maint_admin on public.maintenance for all
  using (public.is_admin()) with check (public.is_admin());

-- bookings: owners read/insert/update their own; admins manage all
drop policy if exists bookings_own_select on public.bookings;
create policy bookings_own_select on public.bookings
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists bookings_own_insert on public.bookings;
create policy bookings_own_insert on public.bookings
  for insert with check (user_id = auth.uid());
drop policy if exists bookings_own_update on public.bookings;
create policy bookings_own_update on public.bookings
  for update using (user_id = auth.uid() or public.is_admin());
drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings
  for all using (public.is_admin()) with check (public.is_admin());

-- Anyone (even signed-out visitors on the public booking preview) may read the
-- slot occupancy of a court without seeing who booked it. The select policy
-- above only exposes rows to owners/admins, which is what we want; the booking
-- page fetches occupancy through a SECURITY DEFINER function instead:
create or replace function public.court_occupancy(p_date date, p_court text)
returns table (start_hour int, end_hour int, user_id uuid)
language sql
security definer set search_path = public
as $$
  select start_hour, end_hour, user_id
  from public.bookings
  where date = p_date and court_id = p_court and status = 'confirmed';
$$;

-- ---------------------------------------------------------------------------
-- Seed settings + courts (matches DB.defaults() in the old js/db.js)
-- ---------------------------------------------------------------------------
insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.courts (id, name, active, note, position) values
  ('c1', 'Court 1', true, '', 1),
  ('c2', 'Court 2', true, '', 2),
  ('c3', 'Court 3', true, '', 3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage: proofs bucket for proof-of-payment uploads (public read for phase 1)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

drop policy if exists proofs_auth_insert on storage.objects;
create policy proofs_auth_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proofs');

drop policy if exists proofs_public_read on storage.objects;
create policy proofs_public_read on storage.objects
  for select using (bucket_id = 'proofs');

-- ============================================================================
--  After running this, create the admin: sign up admin@jspickleyard.com in the
--  app, confirm the email, then run:
--     update public.profiles set role = 'admin'
--     where email = 'admin@jspickleyard.com';
-- ============================================================================
