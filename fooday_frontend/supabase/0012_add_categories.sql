-- ============================================================================
-- Fooday - Multi-category dishes (Ăn chính / Nước nôi / Ăn vặt).
-- A place can belong to several categories at once (it may sell mains,
-- drinks AND snacks). The list is stored as a jsonb array; the legacy
-- `category` text column keeps carrying the first selected value so every
-- older view and query stays alive.
-- Idempotent - safe to re-run and safe on already-migrated DBs.
-- Run in Supabase Dashboard -> SQL Editor.
-- ============================================================================

alter table public.foods
  add column if not exists categories jsonb default '[]'::jsonb;

-- Existing dishes keep working: the single `category` becomes their list.
update public.foods
set categories = jsonb_build_array(category)
where categories is null
   or jsonb_typeof(categories) <> 'array'
   or jsonb_array_length(categories) = 0;

-- Optional sanity check on the stored shape.
-- alter table public.foods
--   add constraint foods_categories_is_array
--   check (jsonb_typeof(categories) = 'array');
