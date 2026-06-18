-- ============================================================================
-- Fooday — Phase 2A schema: foods catalog + favorites (normalized on food_id)
-- Run in Supabase Dashboard → SQL Editor (idempotent / safe to re-run).
-- Supersedes the earlier name-keyed supabase/favorites.sql.
-- ============================================================================

-- 1. foods: the public dish catalog -----------------------------------------
create table if not exists public.foods (
  id          bigint generated always as identity primary key,
  slug        text unique not null,            -- stable ref, e.g. 'spicy-beef-ramen'
  name        text not null,
  category    text not null check (category in ('Foods','Drinks','Snacks')),
  restaurant  text not null,
  rating      numeric(2,1) not null,
  image_url   text not null,
  tag         text,
  created_at  timestamptz not null default now()
);

alter table public.foods enable row level security;

drop policy if exists "foods_readable_by_everyone" on public.foods;
create policy "foods_readable_by_everyone"
  on public.foods for select
  to anon, authenticated
  using (true);
-- (no insert/update/delete policy → catalog is edited only via dashboard / service role)

-- 2. favorites: user ↔ dish (works for anon "guest" + email users) ----------
create table if not exists public.favorites (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  food_id    bigint      not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 3. realtime so favorites sync live across a user's devices (run-once) ------
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

-- 4. seed the catalog (from src/data/foods.ts) ------------------------------
insert into public.foods (slug, name, category, restaurant, rating, image_url, tag) values
  ('spicy-beef-ramen','Spicy Beef Ramen','Foods','Noodle House',4.8,'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80','Trending'),
  ('classic-beef-burger','Classic Beef Burger','Foods','Burger Lab',4.7,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',null),
  ('crispy-fried-chicken','Crispy Fried Chicken','Foods','Seoul Chicken',4.9,'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80','Top rated'),
  ('rainbow-poke-bowl','Rainbow Poke Bowl','Foods','Green Life',4.6,'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80','Healthy'),
  ('wood-fired-pizza','Wood-Fired Pizza','Foods','Bella Forno',4.8,'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',null),
  ('salmon-sushi-platter','Salmon Sushi Platter','Foods','Sakana',4.7,'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80',null),
  ('garden-buddha-bowl','Garden Buddha Bowl','Foods','Green Life',4.5,'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80','Healthy'),
  ('grilled-herb-plate','Grilled Herb Plate','Foods','Ocean Grill',4.6,'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',null),
  ('iced-matcha-latte','Iced Matcha Latte','Drinks','Matcha & Co.',4.7,'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80','Trending'),
  ('mixed-berry-smoothie','Mixed Berry Smoothie','Drinks','Smoothie Bar',4.5,'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80',null),
  ('fresh-orange-juice','Fresh Orange Juice','Drinks','Smoothie Bar',4.4,'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80',null),
  ('caramel-latte','Caramel Latte','Drinks','Brew Haus',4.6,'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80',null),
  ('choco-chip-cookies','Choco Chip Cookies','Snacks','Sweet Bakery',4.9,'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=600&q=80','Sweet'),
  ('glazed-donuts','Glazed Donuts','Snacks','Sweet Bakery',4.7,'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80','Sweet')
on conflict (slug) do nothing;
