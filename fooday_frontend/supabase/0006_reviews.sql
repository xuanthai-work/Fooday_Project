-- ============================================================================
-- Fooday - Reviews & Comments for dishes / restaurants.
-- Run in Supabase Dashboard -> SQL Editor (idempotent - safe to re-run).
-- ============================================================================

create table if not exists public.reviews (
  id         bigint generated always as identity primary key,
  food_id    bigint not null references public.foods (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade default auth.uid(),
  user_name  text not null,
  rating     int not null default 5 check (rating >= 1 and rating <= 5),
  comment    text not null,
  created_at timestamptz not null default now()
);

create index if not exists reviews_food_id_created_at_idx
  on public.reviews (food_id, created_at desc);

alter table public.reviews enable row level security;

-- Anyone (guest or signed-in) can read reviews.
drop policy if exists "reviews_readable_by_everyone" on public.reviews;
create policy "reviews_readable_by_everyone"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- Signed-in users (including anonymous "guest" sessions) can post reviews.
drop policy if exists "reviews_insert_authenticated" on public.reviews;
create policy "reviews_insert_authenticated"
  on public.reviews for insert
  to authenticated
  with check (true);

-- Authors can delete their own reviews.
drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own"
  on public.reviews for delete
  to authenticated
  using (user_id = auth.uid());

-- Realtime so new comments appear live (guarded so re-running is safe).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reviews'
  ) then
    alter publication supabase_realtime add table public.reviews;
  end if;
end $$;
