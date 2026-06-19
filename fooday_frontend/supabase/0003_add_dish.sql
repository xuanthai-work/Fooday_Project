-- ============================================================================
-- Fooday — "Add a dish": let signed-up (non-guest) users contribute to the
-- shared foods catalog. Run in Supabase Dashboard → SQL Editor (idempotent).
-- ============================================================================

-- Author column. default auth.uid() so client inserts fill it automatically;
-- existing seed rows backfill to null (auth.uid() is null in the SQL editor) = admin.
alter table public.foods
  add column if not exists created_by uuid references auth.users (id)
    on delete set null default auth.uid();

-- INSERT: only non-anonymous users, only their own row
drop policy if exists "foods_insert_signed_up" on public.foods;
create policy "foods_insert_signed_up" on public.foods for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- UPDATE / DELETE: only your own dishes
drop policy if exists "foods_update_own" on public.foods;
create policy "foods_update_own" on public.foods for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy if exists "foods_delete_own" on public.foods;
create policy "foods_delete_own" on public.foods for delete to authenticated
  using (created_by = (select auth.uid()));
-- (the public SELECT policy from 0001 stays as-is)

-- Storage bucket for uploaded dish photos (public read).
insert into storage.buckets (id, name, public)
values ('dish-images', 'dish-images', true)
on conflict (id) do nothing;

drop policy if exists "dish_images_insert_signed_up" on storage.objects;
create policy "dish_images_insert_signed_up" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dish-images'
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
