-- ============================================================================
-- Fooday - Optional amount the reviewer actually paid (VND).
-- Run in Supabase Dashboard -> SQL Editor (idempotent - safe to re-run).
-- ============================================================================

alter table public.reviews
  add column if not exists paid_price int4;

alter table public.reviews
  drop constraint if exists reviews_paid_price_range;

alter table public.reviews
  add constraint reviews_paid_price_range
  check (paid_price is null or (paid_price > 0 and paid_price <= 10000000));
