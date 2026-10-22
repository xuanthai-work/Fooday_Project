-- ============================================================================
-- Fooday - Open editing for every signed-in account + GitHub-style
-- contributors list.
--   1. Any signed-in (non-guest) account may update any dish of the catalog.
--   2. The `contributors` jsonb column remembers who helped build a dish
--      (the creator stays in `created_by`).
-- Idempotent - safe to re-run and safe on already-migrated DBs.
-- Run in Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. UPDATE: every signed-in (non-anonymous) user may edit any dish.
drop policy if exists "foods_update_own" on public.foods;
drop policy if exists "foods_update_authenticated" on public.foods;
create policy "foods_update_authenticated"
  on public.foods for update
  to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- 2. Contributors: [{ id, name, avatar_url, updated_at }, ...]
alter table public.foods
  add column if not exists contributors jsonb default '[]'::jsonb;

-- Existing dishes keep working: they simply have no contributor yet.
update public.foods
set contributors = '[]'::jsonb
where contributors is null;

-- Optional sanity check on the stored shape.
-- alter table public.foods
--   add constraint foods_contributors_is_array
--   check (jsonb_typeof(contributors) = 'array');
