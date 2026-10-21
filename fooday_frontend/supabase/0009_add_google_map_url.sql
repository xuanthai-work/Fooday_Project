-- ============================================================================
-- Fooday - Google Maps link for restaurants.
-- Stores the Google Maps URL that the user pastes when adding a dish, so the
-- "Get directions" button in the Dish Detail modal opens the exact place.
-- Idempotent - safe to re-run and safe on already-migrated DBs.
-- Run in Supabase Dashboard -> SQL Editor.
-- ============================================================================

alter table public.foods
  add column if not exists google_map_url text;
