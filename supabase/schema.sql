-- SLG Housekeeping & Facility Services: daily attendance schema.
-- Paste this whole file into the Supabase SQL editor and run it once.

-- 1. Table ---------------------------------------------------------------
create table if not exists public.daily_attendance (
  id               bigint generated always as identity primary key,
  attendance_date  date not null unique,
  anandapuram      text not null,
  slg              text not null,
  madam            text not null,
  kothavalasa      text not null,
  airport          text not null,
  dj               text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- No records before the start date (21/10/2026).
  constraint attendance_date_not_before_start
    check (attendance_date >= date '2026-10-21'),

  -- Each team value is 'Leave' or a whole number 0-100 with no leading zeros.
  constraint anandapuram_valid check (anandapuram ~ '^(100|[1-9][0-9]|[0-9])$' or anandapuram = 'Leave'),
  constraint slg_valid         check (slg         ~ '^(100|[1-9][0-9]|[0-9])$' or slg         = 'Leave'),
  constraint madam_valid       check (madam       ~ '^(100|[1-9][0-9]|[0-9])$' or madam       = 'Leave'),
  constraint kothavalasa_valid check (kothavalasa ~ '^(100|[1-9][0-9]|[0-9])$' or kothavalasa = 'Leave'),
  constraint airport_valid     check (airport     ~ '^(100|[1-9][0-9]|[0-9])$' or airport     = 'Leave'),
  constraint dj_valid          check (dj          ~ '^(100|[1-9][0-9]|[0-9])$' or dj          = 'Leave')
);

-- 2. updated_at trigger --------------------------------------------------
-- "default now()" only covers inserts, so refresh updated_at on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_attendance_set_updated_at on public.daily_attendance;
create trigger daily_attendance_set_updated_at
  before update on public.daily_attendance
  for each row execute function public.set_updated_at();

-- 3. Row Level Security --------------------------------------------------
-- With RLS on and no policy, the anon key can do nothing. We allow SELECT,
-- INSERT, UPDATE and DELETE. DELETE lets the app remove a day's record from
-- the form. There is no login, so anyone with the site link can delete.
alter table public.daily_attendance enable row level security;

drop policy if exists "anon can read attendance"   on public.daily_attendance;
drop policy if exists "anon can insert attendance" on public.daily_attendance;
drop policy if exists "anon can update attendance" on public.daily_attendance;
drop policy if exists "anon can delete attendance" on public.daily_attendance;

create policy "anon can read attendance"
  on public.daily_attendance for select
  to anon
  using (true);

create policy "anon can insert attendance"
  on public.daily_attendance for insert
  to anon
  with check (true);

create policy "anon can update attendance"
  on public.daily_attendance for update
  to anon
  using (true)
  with check (true);

create policy "anon can delete attendance"
  on public.daily_attendance for delete
  to anon
  using (true);

-- 4. Table privileges ----------------------------------------------------
-- Grants mirror the policies.
grant select, insert, update, delete on public.daily_attendance to anon;
