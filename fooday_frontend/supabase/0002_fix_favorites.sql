-- ============================================================================
-- One-time fix: the `favorites` table predates the normalized schema — it was
-- created earlier with `food_name text`, so 0001's `create table if not exists`
-- skipped it and it never got the `food_id` column. Drop and recreate it.
-- (No real data to lose — only guest/test rows.)
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================================

drop table if exists public.favorites cascade;

create table public.favorites (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  food_id    bigint      not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.favorites enable row level security;

create policy "favorites_select_own" on public.favorites for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "favorites_insert_own" on public.favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "favorites_delete_own" on public.favorites for delete to authenticated
  using ((select auth.uid()) = user_id);

-- drop cascade removed it from the realtime publication; re-add it
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'favorites'
  ) then
    alter publication supabase_realtime add table public.favorites;
  end if;
end $$;
