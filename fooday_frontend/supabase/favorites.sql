-- ============================================================================
-- Fooday — favorites table + Row Level Security
-- Run this in the Supabase Dashboard → SQL Editor (safe to re-run).
--
-- Stores one row per (user, dish). `food_name` matches the dish names in
-- src/data/foods.ts (e.g. 'Spicy Beef Ramen'). Keyed on auth.uid(), so it works
-- for both real accounts AND anonymous/guest sign-ins (anon users get a uid too).
-- ============================================================================

-- 1. Table -------------------------------------------------------------------
create table if not exists public.favorites (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,
  food_name   text        not null,
  created_at  timestamptz not null default now(),
  -- one favorite per dish per user → makes "toggle" idempotent
  unique (user_id, food_name)
);

-- Fast "list my favorites, newest first"
create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc);

-- 2. Row Level Security ------------------------------------------------------
alter table public.favorites enable row level security;

-- Each user may only read/insert/delete their OWN rows.
-- (select auth.uid()) is wrapped so Postgres caches it per-statement (RLS perf).
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select
  to authenticated
  using ( (select auth.uid()) = user_id );

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

-- 3. (Optional) live sync across the user's devices --------------------------
-- Adds the table to the realtime publication. Run once; remove if not needed.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'favorites'
  ) then
    alter publication supabase_realtime add table public.favorites;
  end if;
end $$;
