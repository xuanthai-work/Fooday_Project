-- ============================================================================
-- Fooday - Restaurant / dish detail fields.
-- Adds the columns used by the Dish Detail modal (address, opening hours,
-- review note). Idempotent - safe to re-run and safe on already-migrated DBs.
-- Run in Supabase Dashboard -> SQL Editor.
-- ============================================================================

alter table public.foods
  add column if not exists address      text,
  add column if not exists opening_time text,
  add column if not exists review_note  text;
