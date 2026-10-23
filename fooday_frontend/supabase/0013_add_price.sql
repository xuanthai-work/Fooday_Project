-- ============================================================================
-- Fooday - Dish price.
-- Reference price of one dish at one restaurant, in VND.
-- null = unknown: every view falls back to the text-based estimate and shows
-- the amount with a leading `~` (e.g. "~40k").
-- Idempotent - safe to re-run and safe on already-migrated DBs.
-- Run in Supabase Dashboard -> SQL Editor.
-- ============================================================================

alter table public.foods
  add column if not exists price integer;

-- Sanity guard: 0 .. 10,000,000 VND.
alter table public.foods
  drop constraint if exists foods_price_range;
alter table public.foods
  add constraint foods_price_range
  check (price is null or (price >= 0 and price <= 10000000));

comment on column public.foods.price is
  'Reference price of the dish at this restaurant, in VND (null = unknown).';

-- The Random tab filters by budget, so keep an index on it.
create index if not exists foods_price_idx
  on public.foods (price)
  where price is not null;
