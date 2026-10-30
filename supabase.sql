-- PRANIKA ROCKS ATTENDANCE: run this entire script in Supabase > SQL Editor.
-- Create your first account using Staff registration, then promote it to admin
-- with the SQL statement at the bottom (replace the email address).

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role text not null default 'staff' check (role in ('admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  check_in timestamptz,
  check_out timestamptz,
  method text not null default 'qr' check (method in ('qr','manual')),
  note text not null default '',
  marked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(staff_id, work_date)
);

create table if not exists public.daily_qr_tokens (
  work_date date primary key,
  token text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role='admin' and active=true); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.attendance enable row level security;
alter table public.daily_qr_tokens enable row level security;

drop policy if exists "profiles read self or admin" on public.profiles;
create policy "profiles read self or admin" on public.profiles for select to authenticated
using (id=auth.uid() or public.is_admin());

drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles" on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "attendance read self or admin" on public.attendance;
create policy "attendance read self or admin" on public.attendance for select to authenticated
using (staff_id=auth.uid() or public.is_admin());

drop policy if exists "attendance insert self or admin" on public.attendance;
create policy "attendance insert self or admin" on public.attendance for insert to authenticated
with check ((staff_id=auth.uid() or public.is_admin()) and (marked_by=auth.uid() or marked_by is null));

drop policy if exists "attendance update self or admin" on public.attendance;
create policy "attendance update self or admin" on public.attendance for update to authenticated
using (staff_id=auth.uid() or public.is_admin())
with check (staff_id=auth.uid() or public.is_admin());

drop policy if exists "qr read authenticated" on public.daily_qr_tokens;
create policy "qr read authenticated" on public.daily_qr_tokens for select to authenticated using (true);

drop policy if exists "qr admin insert" on public.daily_qr_tokens;
create policy "qr admin insert" on public.daily_qr_tokens for insert to authenticated
with check (public.is_admin() and created_by=auth.uid());

drop policy if exists "qr admin update" on public.daily_qr_tokens;
create policy "qr admin update" on public.daily_qr_tokens for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Promote your own first account to admin after registering:
-- update public.profiles set role='admin' where email='YOUR_ADMIN_EMAIL';

-- Version 2.0 attendance metadata. Run this for an existing database.
alter table public.attendance add column if not exists latitude double precision;
alter table public.attendance add column if not exists longitude double precision;
alter table public.attendance add column if not exists location_accuracy_m double precision;
alter table public.attendance add column if not exists face_check text not null default 'not_applicable';
