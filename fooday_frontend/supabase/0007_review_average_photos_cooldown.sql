-- ============================================================================
-- Fooday - Review average, one review per account per 45 days, review photos.
-- Run in Supabase Dashboard -> SQL Editor (idempotent - safe to re-run).
-- ============================================================================

alter table public.reviews
  add column if not exists image_url text;

-- Remembers the last review even if the comment is later deleted,
-- so deleting a review does not reset the 45-day limit.
create table if not exists public.review_limits (
  user_id     uuid not null references auth.users (id) on delete cascade,
  food_id     bigint not null references public.foods (id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.review_limits enable row level security;

drop policy if exists "review_limits_select_own" on public.review_limits;
create policy "review_limits_select_own"
  on public.review_limits for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Own reviews only. user_id defaults to auth.uid().
drop policy if exists "reviews_insert_authenticated" on public.reviews;
create policy "reviews_insert_authenticated"
  on public.reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create or replace function public.enforce_review_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    raise exception 'review_signin_required';
  end if;

  if exists (
    select 1
    from public.review_limits
    where user_id = new.user_id
      and food_id = new.food_id
      and reviewed_at > now() - interval '45 days'
  ) or exists (
    select 1
    from public.reviews
    where user_id = new.user_id
      and food_id = new.food_id
      and created_at > now() - interval '45 days'
  ) then
    raise exception 'review_cooldown';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_cooldown_before_insert on public.reviews;
create trigger reviews_cooldown_before_insert
  before insert on public.reviews
  for each row
  execute function public.enforce_review_cooldown();

create or replace function public.sync_food_rating_from_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target bigint;
  avg_rating numeric;
  n int;
begin
  target := coalesce(new.food_id, old.food_id);

  if tg_op = 'INSERT' and new.user_id is not null then
    insert into public.review_limits (user_id, food_id, reviewed_at)
    values (new.user_id, new.food_id, coalesce(new.created_at, now()))
    on conflict (user_id, food_id)
    do update set reviewed_at = excluded.reviewed_at;
  end if;

  select round(avg(rating)::numeric, 1), count(*)::int
    into avg_rating, n
  from public.reviews
  where food_id = target;

  if n > 0 then
    update public.foods
      set rating = avg_rating
      where id = target;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_sync_food_rating on public.reviews;
create trigger reviews_sync_food_rating
  after insert or update of rating or delete on public.reviews
  for each row
  execute function public.sync_food_rating_from_reviews();

-- Backfill limits and live averages from reviews already posted.
insert into public.review_limits (user_id, food_id, reviewed_at)
select user_id, food_id, max(created_at)
from public.reviews
where user_id is not null
group by user_id, food_id
on conflict (user_id, food_id)
do update set reviewed_at = excluded.reviewed_at;

update public.foods as f
set rating = s.avg_rating
from (
  select food_id, round(avg(rating)::numeric, 1) as avg_rating
  from public.reviews
  group by food_id
) as s
where f.id = s.food_id;

-- Photos attached to a review.
insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do nothing;

drop policy if exists "review_images_select_public" on storage.objects;
create policy "review_images_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'review-images');

drop policy if exists "review_images_insert_own" on storage.objects;
create policy "review_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'review-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "review_images_delete_own" on storage.objects;
create policy "review_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'review-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
