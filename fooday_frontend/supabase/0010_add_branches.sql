-- ============================================================================
-- Fooday - Multiple branches per restaurant.
-- Stores the extra outlets of a restaurant (name, address, Google Maps link
-- and its own opening hours) as a jsonb array. The first entry of the array
-- is an additional branch; the main branch always stays in the `address` /
-- `google_map_url` / `opening_time` columns of the dish.
-- Idempotent - safe to re-run and safe on already-migrated DBs.
-- Run in Supabase Dashboard -> SQL Editor.
-- ============================================================================

alter table public.foods
  add column if not exists branches jsonb default '[]'::jsonb;

-- Existing dishes keep working: they simply have no extra branch yet.
update public.foods
set branches = '[]'::jsonb
where branches is null;

-- Optional sanity check on the stored shape.
-- alter table public.foods
--   add constraint foods_branches_is_array
--   check (jsonb_typeof(branches) = 'array');
